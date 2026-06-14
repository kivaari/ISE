package main

import (
    "math"
    mathrand "math/rand"
    "net/http"

    "github.com/gin-gonic/gin"
)

func GetCatalog(c *gin.Context) {
    keys, _ := rdb.Keys(ctx, "node:*").Result()
    nodes := []map[string]string{}
    for _, key := range keys {
        nodeData, _ := rdb.HGetAll(ctx, key).Result()
        if nodeData["status"] == "online" || nodeData["status"] == "busy" {
            nodes = append(nodes, nodeData)
        }
    }
    c.JSON(http.StatusOK, nodes)
}

func ConnectNode(c *gin.Context) {
    cpUs := []string{"Intel Core i9-13900K", "AMD Ryzen 9 7950X", "Intel Xeon W-2295"}
    gpus := []string{"NVIDIA RTX 4090", "NVIDIA RTX 3090", "NVIDIA A100", "RTX 3080"}
    categories := []string{"ml", "web", "game"}
    categoryNames := map[string]string{"ml": "Обучение моделей", "web": "Хостинг сайтов", "game": "Игровые серверы"}
    descriptions := map[string]string{
        "ml":   "Мощный GPU-сервер для обучения нейросетей. Предустановлены CUDA, PyTorch, TensorFlow.",
        "web":  "Стабильный сервер с SSD кэшем и защитой от DDoS для высоконагруженных веб-приложений.",
        "game": "Низкий пинг и высокая тактовая частота CPU. Идеально для Minecraft, Rust, CS2.",
    }
    providerID := "a1b2c3d4-0002-0002-0002-000000000002"

    cat := categories[mathrand.Intn(len(categories))]
    cpuModel := cpUs[mathrand.Intn(len(cpUs))]
    gpuModel := gpus[mathrand.Intn(len(gpus))]
    vram := (mathrand.Intn(3) + 1) * 12
    ram := (mathrand.Intn(4) + 1) * 16
    ssd := (mathrand.Intn(3) + 1) * 512
    price := float64(mathrand.Intn(300)+100) * map[string]float64{"ml": 1.5, "game": 1.2, "web": 1.0}[cat]
    rating := math.Round((3.5+mathrand.Float64()*1.5)*10) / 10

    tx, _ := db.Begin()
    var nodeID string
    err := tx.QueryRow(`INSERT INTO nodes (provider_id, status, category, price_per_hour, rating, description) VALUES ($1, 'online', $2, $3, $4, $5) RETURNING id`, providerID, cat, price, rating, descriptions[cat]).Scan(&nodeID)
    if err != nil {
        tx.Rollback()
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }

    tx.Exec(`INSERT INTO hardware_specs (node_id, cpu_model, gpu_model, gpu_vram_gb, ram_gb, disk_gb) VALUES ($1, $2, $3, $4, $5, $6)`, nodeID, cpuModel, gpuModel, vram, ram, ssd)
    tx.Commit()

    syncCatalogToRedis()
    c.JSON(200, gin.H{"node_id": nodeID, "specs": gin.H{"cpu_model": cpuModel, "gpu_model": gpuModel, "gpu_vram_gb": vram, "ram_gb": ram, "ssd_gb": ssd, "category": cat, "category_name": categoryNames[cat]}})
}