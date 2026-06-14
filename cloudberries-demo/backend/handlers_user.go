package main

import (
    "net/http"

    "github.com/gin-gonic/gin"
)

func GetProfile(c *gin.Context) {
    var balance, frozen float64
    db.QueryRow("SELECT balance, frozen_amount FROM wallets WHERE user_id = 'a1b2c3d4-0001-0001-0001-000000000001'").Scan(&balance, &frozen)
    c.JSON(200, gin.H{"balance": balance, "frozen": frozen})
}

func GetProviderProfile(c *gin.Context) {
    var balance, frozen float64
    db.QueryRow("SELECT balance, frozen_amount FROM wallets WHERE user_id = 'a1b2c3d4-0002-0002-0002-000000000002'").Scan(&balance, &frozen)
    c.JSON(200, gin.H{"balance": balance, "frozen": frozen})
}

func TopUp(c *gin.Context) {
    var req struct {
        Amount float64 `json:"amount"`
    }
    c.ShouldBindJSON(&req)
    db.Exec("UPDATE wallets SET balance = balance + $1 WHERE user_id = 'a1b2c3d4-0001-0001-0001-000000000001'", req.Amount)
    c.JSON(200, gin.H{"message": "Баланс пополнен"})
}

func GetClientBookings(c *gin.Context) {
    clientID := "a1b2c3d4-0001-0001-0001-000000000001"

    rows, err := db.Query(`
        SELECT b.id, b.node_id, b.status, b.total_amount, b.created_at, 
               n.price_per_hour, hs.gpu_model, 
               COALESCE(ac.ssh_login, ''), COALESCE(ac.ssh_pass, ''), COALESCE(ac.ip_address, '')
        FROM bookings b
        JOIN nodes n ON b.node_id = n.id
        JOIN hardware_specs hs ON n.id = hs.node_id
        LEFT JOIN access_credentials ac ON b.id = ac.booking_id
        WHERE b.client_id = $1
        ORDER BY b.created_at DESC
    `, clientID)

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    defer rows.Close()

    type BookingItem struct {
        BookingID   string  `json:"booking_id"`
        NodeID      string  `json:"node_id"`
        Status      string  `json:"status"`
        TotalAmount float64 `json:"total_amount"`
        CreatedAt   string  `json:"created_at"`
        PricePerHour float64 `json:"price_per_hour"`
        GpuModel    string  `json:"gpu_model"`
        SshLogin    string  `json:"ssh_login"`
        SshPass     string  `json:"ssh_pass"`
        IpAddress   string  `json:"ip_address"`
    }

    bookings := make([]BookingItem, 0)
    for rows.Next() {
        var b BookingItem
        rows.Scan(&b.BookingID, &b.NodeID, &b.Status, &b.TotalAmount, &b.CreatedAt, 
                  &b.PricePerHour, &b.GpuModel, &b.SshLogin, &b.SshPass, &b.IpAddress)
        bookings = append(bookings, b)
    }

    c.JSON(http.StatusOK, bookings)
}