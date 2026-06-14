package main

import (
    "database/sql"
    "log"

    "github.com/gin-gonic/gin"
    _ "github.com/lib/pq"
    "github.com/redis/go-redis/v9"
)

func main() {
    var err error
    connStr := "host=127.0.0.1 user=berries password=berries dbname=cloudberries sslmode=disable"
    db, err = sql.Open("postgres", connStr)
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    rdb = redis.NewClient(&redis.Options{Addr: "localhost:6379"})
    syncCatalogToRedis()

    r := gin.Default()
    r.Use(CORSMiddleware())

    r.GET("/api/catalog", GetCatalog)
    r.GET("/api/profile", GetProfile)
    r.GET("/api/provider/profile", GetProviderProfile)
    r.POST("/api/topup", TopUp)
    r.POST("/api/book", BookNode)
    r.POST("/api/start-session", StartSession)
    r.POST("/api/complete-session", CompleteSession)
    r.POST("/api/agent/connect", ConnectNode)

    r.GET("/api/client/bookings", GetClientBookings)

    r.GET("/api/provider/bookings", GetProviderBookings)
    r.GET("/api/provider/booking/:id/metrics", GetBookingMetrics)

    r.POST("/api/report-issue", ReportIssue)
    r.GET("/api/admin/disputes", GetDisputes)
    r.GET("/api/admin/dispute/:id", GetDisputeDetails)
    r.POST("/api/admin/resolve", ResolveDispute)

    r.StaticFile("/", "../frontend/index.html")
    r.StaticFile("/styles.css", "../frontend/styles.css")
    r.StaticFile("/logo.png", "../frontend/logo.png")
    r.Static("/js", "../frontend/js")

    log.Fatal(r.Run(":8080"))
}