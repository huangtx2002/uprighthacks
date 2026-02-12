import Foundation

struct TelemetryMessage: Codable {
    // meta
    let kind: String?          // "sample" | "event"
    let type: String?          // "insight_update" (alternative to kind)
    let source: Int?           // 1 | 2
    let ts: Double?

    // posture / sample fields
    let pitch: Double?
    let pitch_smooth: Double?
    let roll: Double?

    let ax: Double?
    let ay: Double?
    let az: Double?

    let a_mag: Double?
    let dpitch: Double?
    let baseline_pitch: Double?

    // event fields
    let event: String?
    let button: Int?
    let button_click: Int?
    
    // insight_update fields
    let windowStart: String?
    let windowEnd: String?
    let rating: String?           // "good" | "fair" | "not_so_good" | "poor"
    let summary: String?
    let issues: [String]?
    let suggestions: [String]?
    let tip: String?
    let confidence: String?       // "low" | "medium" | "high"
    let features: InsightFeatures?
}

struct InsightFeatures: Codable {
    let sensor1: SensorStats?
    let sensor2: SensorStats?
    let alignment: AlignmentStats?
    let quality: QualityStats?
}

struct SensorStats: Codable {
    let sampleCount: Int?
    let meanPitch: Double?
    let stdDevPitch: Double?
    let minPitch: Double?
    let maxPitch: Double?
    let slouchPercent: Double?
    let hasData: Bool?
}

struct AlignmentStats: Codable {
    let pitchDifference: Double?
    let alignmentScore: Double?
    let bothActive: Bool?
}

struct QualityStats: Codable {
    let lowSamples: Bool?
    let missingSensor1: Bool?
    let missingSensor2: Bool?
    let onlyOneSensor: Bool?
    let dataQuality: String?
}
