package main

import (
    "net/http"

    "github.com/gin-gonic/gin"
)

func GetProviderBookings(c *gin.Context) {
    providerID := "a1b2c3d4-0002-0002-0002-000000000002"

    rows, err := db.Query(`
        SELECT b.id, b.node_id, b.status, b.total_amount, b.created_at, 
               hs.cpu_model, hs.gpu_model,
               COALESCE(d.status, ''), COALESCE(d.resolution, '')
        FROM bookings b
        JOIN nodes n ON b.node_id = n.id
        JOIN hardware_specs hs ON n.id = hs.node_id
        LEFT JOIN disputes d ON b.id = d.booking_id
        WHERE n.provider_id = $1
        ORDER BY b.created_at DESC
    `, providerID)

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    defer rows.Close()

    

    bookings := make([]BookingItem, 0)
    for rows.Next() {
        var b BookingItem
        rows.Scan(&b.BookingID, &b.NodeID, &b.Status, &b.TotalAmount, &b.CreatedAt, 
                  &b.CPU, &b.GPU, &b.DisputeStatus, &b.DisputeResolution)
        if len(b.CreatedAt) > 19 {
            b.CreatedAt = b.CreatedAt[:19]
        }
        bookings = append(bookings, b)
    }

    c.JSON(http.StatusOK, bookings)
}

func GetBookingMetrics(c *gin.Context) {
    bookingID := c.Param("id")

    var sessionID string
    err := db.QueryRow("SELECT id FROM telemetry_sessions WHERE booking_id = $1", bookingID).Scan(&sessionID)
    if err != nil {
        c.JSON(http.StatusOK, []interface{}{})
        return
    }

    rows, err := db.Query(`SELECT timestamp_sec, cpu_load, ram_used_mb, gpu_temp, disk_io 
                           FROM metrics_snapshots 
                           WHERE telemetry_session_id = $1 ORDER BY timestamp_sec ASC`, sessionID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    defer rows.Close()



    metrics := make([]MetricResp, 0)
    for rows.Next() {
        var m MetricResp
        rows.Scan(&m.Sec, &m.CPU, &m.RAM, &m.GPUTemp, &m.DiskIO)
        metrics = append(metrics, m)
    }

    c.JSON(http.StatusOK, metrics)
}