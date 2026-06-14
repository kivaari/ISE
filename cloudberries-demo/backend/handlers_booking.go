package main

import (
    "fmt"
    "math"
    mathrand "math/rand"

    "github.com/gin-gonic/gin"
)

func BookNode(c *gin.Context) {
    var req struct {
        NodeID string `json:"node_id"`
        Hours  int    `json:"hours"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    clientID := "a1b2c3d4-0001-0001-0001-000000000001"
    idempotencyKey := uuid()

    var pricePerHour float64
    err := db.QueryRow("SELECT price_per_hour FROM nodes WHERE id = $1 AND status = 'online'", req.NodeID).Scan(&pricePerHour)
    if err != nil {
        c.JSON(400, gin.H{"error": "Нода не найдена"})
        return
    }

    totalAmount := pricePerHour * float64(req.Hours)

    tx, _ := db.Begin()
    res, err := tx.Exec("UPDATE wallets SET balance = balance - $1, frozen_amount = frozen_amount + $1 WHERE user_id = $2 AND balance >= $1", totalAmount, clientID)
    if rowsAffected, _ := res.RowsAffected(); rowsAffected == 0 {
        tx.Rollback()
        c.JSON(400, gin.H{"error": "Недостаточно средств"})
        return
    }

    var bookingID string
    err = tx.QueryRow(`INSERT INTO bookings (client_id, node_id, status, total_amount, idempotency_key) VALUES ($1, $2, 'pending', $3, $4) RETURNING id`, clientID, req.NodeID, totalAmount, idempotencyKey).Scan(&bookingID)
    if err != nil {
        tx.Rollback()
        c.JSON(500, gin.H{"error": "Booking failed"})
        return
    }

    tx.Exec(`INSERT INTO escrow_transactions (booking_id, amount, status, idempotency_key) VALUES ($1, $2, 'hold', $3)`, bookingID, totalAmount, idempotencyKey)

    sshLogin := "root"
    sshPass := fmt.Sprintf("pass%d", mathrand.Intn(9000)+1000)
    sshIP := fmt.Sprintf("192.168.%d.%d", mathrand.Intn(255), mathrand.Intn(255))
    tx.Exec(`INSERT INTO access_credentials (booking_id, ssh_login, ssh_pass, ip_address) VALUES ($1, $2, $3, $4)`, bookingID, sshLogin, sshPass, sshIP)

    tx.Exec("UPDATE nodes SET status = 'busy' WHERE id = $1", req.NodeID)
    tx.Commit()

    syncCatalogToRedis()
    c.JSON(200, gin.H{"booking_id": bookingID, "total_amount": totalAmount, "ssh_login": sshLogin, "ssh_pass": sshPass, "ssh_ip": sshIP})
}

func StartSession(c *gin.Context) {
    var req struct {
        BookingID string `json:"booking_id"`
    }
    c.ShouldBindJSON(&req)

    var nodeID string
    db.QueryRow("SELECT node_id FROM bookings WHERE id = $1", req.BookingID).Scan(&nodeID)

    var sessionID string
    db.QueryRow(`INSERT INTO telemetry_sessions (node_id, booking_id, status) VALUES ($1, $2, 'active') RETURNING id`, nodeID, req.BookingID).Scan(&sessionID)

    db.Exec("UPDATE bookings SET status = 'active' WHERE id = $1", req.BookingID)
    c.JSON(200, gin.H{"session_id": sessionID, "message": "Сессия запущена"})
}

func CompleteSession(c *gin.Context) {
    var req struct {
        BookingID string `json:"booking_id"`
    }
    c.ShouldBindJSON(&req)

    clientID := "a1b2c3d4-0001-0001-0001-000000000001"
    providerID := "a1b2c3d4-0002-0002-0002-000000000002"

    var totalAmount float64
    var nodeID string
    db.QueryRow("SELECT total_amount, node_id FROM bookings WHERE id = $1", req.BookingID).Scan(&totalAmount, &nodeID)

    tx, _ := db.Begin()
    providerPayout := math.Round(totalAmount*0.95*100) / 100
    tx.Exec("UPDATE wallets SET frozen_amount = frozen_amount - $1 WHERE user_id = $2", totalAmount, clientID)
    tx.Exec("UPDATE wallets SET balance = balance + $1 WHERE user_id = $2", providerPayout, providerID)
    tx.Exec("UPDATE escrow_transactions SET status = 'captured' WHERE booking_id = $1", req.BookingID)
    tx.Exec("UPDATE bookings SET status = 'completed' WHERE id = $1", req.BookingID)
    tx.Exec("UPDATE nodes SET status = 'online' WHERE id = $1", nodeID)
    tx.Commit()

    syncCatalogToRedis()
    c.JSON(200, gin.H{"payout": providerPayout, "message": "Сессия завершена"})
}