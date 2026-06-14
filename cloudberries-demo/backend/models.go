package main

type TelemetryPoint struct {
    Sec     int     `json:"sec"`
    CPU     float64 `json:"cpu"`
    RAM     int     `json:"ram"`
    GPUTemp float64 `json:"gpu_temp"`
    DiskIO  int     `json:"disk_io"`
}

type MetricResp struct {
    Sec     int     `json:"sec"`
    CPU     float64 `json:"cpu"`
    RAM     int     `json:"ram"`
    GPUTemp float64 `json:"gpu_temp"`
    DiskIO  int     `json:"disk_io"`
}

type BookingItem struct {
    BookingID         string  `json:"booking_id"`
    NodeID            string  `json:"node_id"`
    Status            string  `json:"status"`
    TotalAmount       float64 `json:"total_amount"`
    CreatedAt         string  `json:"created_at"`
    CPU               string  `json:"cpu_model"`
    GPU               string  `json:"gpu_model"`
    DisputeStatus     string  `json:"dispute_status"`
    DisputeResolution string  `json:"dispute_resolution"`
}