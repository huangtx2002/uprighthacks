import Foundation

struct Insight: Identifiable {
    let id: String
    let windowStart: Date
    let windowEnd: Date
    let rating: Rating
    let summary: String
    let issues: [String]
    let suggestions: [String]
    let tip: String
    let confidence: Confidence
    
    enum Rating: String {
        case good = "good"
        case fair = "fair"
        case notSoGood = "not_so_good"
        case poor = "poor"
    }
    
    enum Confidence: String {
        case low = "low"
        case medium = "medium"
        case high = "high"
    }
    
    static func from(message: TelemetryMessage) -> Insight? {
        guard message.type == "insight_update",
              let windowStartStr = message.windowStart,
              let windowEndStr = message.windowEnd,
              let ratingStr = message.rating,
              let rating = Rating(rawValue: ratingStr),
              let summary = message.summary,
              let tip = message.tip,
              let confidenceStr = message.confidence,
              let confidence = Confidence(rawValue: confidenceStr) else {
            return nil
        }
        
        let formatter = ISO8601DateFormatter()
        let windowStart = formatter.date(from: windowStartStr) ?? Date()
        let windowEnd = formatter.date(from: windowEndStr) ?? Date()
        
        return Insight(
            id: windowStartStr,
            windowStart: windowStart,
            windowEnd: windowEnd,
            rating: rating,
            summary: summary,
            issues: message.issues ?? [],
            suggestions: message.suggestions ?? [],
            tip: tip,
            confidence: confidence
        )
    }
}
