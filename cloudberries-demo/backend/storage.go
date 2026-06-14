package main

import (
    "context"
    "crypto/rand"
    "database/sql"
    "encoding/hex"
    "log"

    "github.com/redis/go-redis/v9"
)

var (
    db  *sql.DB
    rdb *redis.Client
    ctx = context.Background()
)

func uuid() string {
    b := make([]byte, 16)
    rand.Read(b)
    return hex.EncodeToString(b)
}

func syncCatalogToRedis() {
    rdb.Del(ctx, "catalog")
    rows, err := db.Query(`SELECT n.id, n.status, n.category, n.price_per_hour, n.rating, n.description, hs.cpu_model, hs.gpu_model, hs.gpu_vram_gb, hs.ram_gb, hs.disk_gb 
                           FROM nodes n JOIN hardware_specs hs ON n.id = hs.node_id`)
    if err != nil {
        return
    }
    defer rows.Close()
    for rows.Next() {
        var id, cpu, gpu, status, category, description string
        var vram, ram, ssd int
        var price, rating float64
        rows.Scan(&id, &status, &category, &price, &rating, &description, &cpu, &gpu, &vram, &ram, &ssd)
        rdb.HSet(ctx, "node:"+id, "id", id, "status", status, "category", category, "price", price, "rating", rating, "description", description, "cpu", cpu, "gpu", gpu, "vram", vram, "ram", ram, "ssd", ssd)
    }
    log.Println("Catalog synced to Redis")
}