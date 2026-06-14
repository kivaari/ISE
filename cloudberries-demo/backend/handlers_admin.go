package main

import (
    "github.com/gin-gonic/gin"
)

func ReportIssue(c *gin.Context) {
    var req struct {
        BookingID string           `json:"booking_id"`
        Metrics   []TelemetryPoint `json:"metrics"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    db.Exec("UPDATE bookings SET status = 'dispute' WHERE id = $1", req.BookingID)

    var disputeID string
    db.QueryRow(`INSERT INTO disputes (booking_id, status) VALUES ($1, 'open') RETURNING id`, req.BookingID).Scan(&disputeID)

    var sessionID string
    db.QueryRow("SELECT id FROM telemetry_sessions WHERE booking_id = $1", req.BookingID).Scan(&sessionID)

    for _, m := range req.Metrics {
        db.Exec(`INSERT INTO metrics_snapshots (telemetry_session_id, timestamp_sec, cpu_load, ram_used_mb, gpu_temp, disk_io) 
                 VALUES ($1, $2, $3, $4, $5, $6)`, sessionID, m.Sec, m.CPU, m.RAM, m.GPUTemp, m.DiskIO)
    }
    c.JSON(200, gin.H{"dispute_id": disputeID, "message": "Аренда заморожена, спор открыт"})
}

func GetDisputes(c *gin.Context) {
    rows, err := db.Query(`SELECT d.id, d.status, d.resolution, d.created_at, ac.ip_address, u.email 
                           FROM disputes d 
                           JOIN bookings b ON d.booking_id = b.id 
                           LEFT JOIN access_credentials ac ON b.id = ac.booking_id
                           JOIN users u ON b.client_id = u.id 
                           ORDER BY d.created_at DESC`)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    defer rows.Close()

    type DisputeItem struct {
        ID          string `json:"id"`
        Status      string `json:"status"`
        Resolution  string `json:"resolution"`
        CreatedAt   string `json:"created_at"`
        NodeIP      string `json:"node_ip"`
        ClientEmail string `json:"client_email"`
    }

    disputes := make([]DisputeItem, 0)
    for rows.Next() {
        var d DisputeItem
        rows.Scan(&d.ID, &d.Status, &d.Resolution, &d.CreatedAt, &d.NodeIP, &d.ClientEmail)
        if len(d.CreatedAt) > 19 {
            d.CreatedAt = d.CreatedAt[:19]
        }
        disputes = append(disputes, d)
    }
    c.JSON(200, disputes)
}

func GetDisputeDetails(c *gin.Context) {
    disputeID := c.Param("id")

    var bookingID, nodeID string
    var totalAmount float64
    var disputeStatus, disputeResolution string
    db.QueryRow(`SELECT b.id, b.node_id, b.total_amount, d.status, d.resolution FROM disputes d JOIN bookings b ON d.booking_id = b.id WHERE d.id = $1`, disputeID).Scan(&bookingID, &nodeID, &totalAmount, &disputeStatus, &disputeResolution)

    var cpuModel, gpuModel string
    var ram, vram int
    db.QueryRow("SELECT cpu_model, gpu_model, ram_gb, gpu_vram_gb FROM hardware_specs WHERE node_id = $1", nodeID).Scan(&cpuModel, &gpuModel, &ram, &vram)

    rows, _ := db.Query(`SELECT ms.timestamp_sec, ms.cpu_load, ms.ram_used_mb, ms.gpu_temp, ms.disk_io 
                         FROM metrics_snapshots ms JOIN telemetry_sessions ts ON ms.telemetry_session_id = ts.id 
                         WHERE ts.booking_id = $1 ORDER BY ms.timestamp_sec ASC`, bookingID)

    type MetricResp struct {
        Sec     int     `json:"sec"`
        CPU     float64 `json:"cpu"`
        RAM     int     `json:"ram"`
        GPUTemp float64 `json:"gpu_temp"`
        DiskIO  int     `json:"disk_io"`
    }

    metrics := make([]MetricResp, 0)
    for rows.Next() {
        var m MetricResp
        rows.Scan(&m.Sec, &m.CPU, &m.RAM, &m.GPUTemp, &m.DiskIO)
        metrics = append(metrics, m)
    }

    c.JSON(200, gin.H{
        "booking_id":         bookingID,
        "total_amount":       totalAmount,
        "dispute_status":     disputeStatus,
        "dispute_resolution": disputeResolution,
        "specs":              gin.H{"cpu": cpuModel, "gpu": gpuModel, "ram": ram, "vram": vram},
        "metrics":            metrics,
    })
}

func ResolveDispute(c *gin.Context) {
    var req struct {
        DisputeID string `json:"dispute_id"`
        Decision  string `json:"decision"`
    }
    c.ShouldBindJSON(&req)

    var bookingID, clientID, nodeID string
    var totalAmount float64
    db.QueryRow(`SELECT b.id, b.client_id, b.node_id, b.total_amount FROM disputes d JOIN bookings b ON d.booking_id = b.id WHERE d.id = $1`, req.DisputeID).Scan(&bookingID, &clientID, &nodeID, &totalAmount)

    var providerID string
    db.QueryRow("SELECT provider_id FROM nodes WHERE id = $1", nodeID).Scan(&providerID)

    tx, _ := db.Begin()
    if req.Decision == "refund" {
        tx.Exec("UPDATE wallets SET balance = balance + $1, frozen_amount = frozen_amount - $1 WHERE user_id = $2", totalAmount, clientID)
        tx.Exec("UPDATE escrow_transactions SET status = 'refunded' WHERE booking_id = $1", bookingID)
        tx.Exec("UPDATE bookings SET status = 'refunded' WHERE id = $1", bookingID)
    } else {
        payout := totalAmount * 0.95
        tx.Exec("UPDATE wallets SET frozen_amount = frozen_amount - $1 WHERE user_id = $2", totalAmount, clientID)
        tx.Exec("UPDATE wallets SET balance = balance + $1 WHERE user_id = $2", payout, providerID)
        tx.Exec("UPDATE escrow_transactions SET status = 'captured' WHERE booking_id = $1", bookingID)
        tx.Exec("UPDATE bookings SET status = 'dispute_lost' WHERE id = $1", bookingID)
    }
    tx.Exec("UPDATE disputes SET status = 'resolved', resolution = $1 WHERE id = $2", req.Decision, req.DisputeID)
    tx.Exec("UPDATE nodes SET status = 'online' WHERE id = $1", nodeID)
    tx.Commit()

    syncCatalogToRedis()
    c.JSON(200, gin.H{"message": "Вердикт вынесен"})
}