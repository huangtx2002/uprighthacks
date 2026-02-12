import Foundation
import Combine

final class PostureViewModel: ObservableObject {

    // Sensor-driven posture
    @Published var upperPitch: Double = 0
    @Published var upperRoll: Double = 0
    @Published var lowerPitch: Double = 0

    // Events
    @Published var lastEvent: String?
    
    // Insights
    @Published var latestInsight: Insight?
    @Published var insightHistory: [Insight] = []

    private let ws = TelemetryWebSocket()

    func start() {
        ws.onMessage = { [weak self] msg in
            DispatchQueue.main.async {
                self?.handle(msg)
            }
        }
        ws.connect()
    }

    func stop() {
        ws.disconnect()
    }

    private func handle(_ msg: TelemetryMessage) {
        // Handle insight updates - only update if window ID is different (prevents immediate updates)
        if msg.type == "insight_update" || (msg.kind == nil && msg.type != nil) {
            if let insight = Insight.from(message: msg) {
                // Only update if this is a different window (prevents re-processing same insight)
                if latestInsight?.id != insight.id {
                    latestInsight = insight
                    // Add to history if not already present
                    if !insightHistory.contains(where: { $0.id == insight.id }) {
                        insightHistory.append(insight)
                        // Keep only last 48 insights (24 hours)
                        if insightHistory.count > 48 {
                            insightHistory.removeFirst()
                        }
                        // Sort by window start (most recent first)
                        insightHistory.sort { $0.windowStart > $1.windowStart }
                    }
                }
            }
            return
        }
        
        // Events
        if msg.kind == "event" {
            lastEvent = msg.event
            return
        }

        // Samples - prefer pitch_smooth over pitch if available
        guard msg.kind == "sample" else { return }
        
        // If we have an insight, check if we're now in a new active window (after the insight's window ended)
        // This clears the insight during the active window period (between window closures)
        if let insight = latestInsight {
            // Timestamp is in milliseconds (from JavaScript Date.now())
            let sampleTimestamp: Date
            if let ts = msg.ts {
                sampleTimestamp = Date(timeIntervalSince1970: ts / 1000.0)
            } else {
                sampleTimestamp = Date()
            }
            
            // If the sample is after the insight's window end, we're in a new active window
            // Clear the insight so it doesn't show between windows
            if sampleTimestamp > insight.windowEnd {
                latestInsight = nil
            }
        }
        
        let pitch = msg.pitch_smooth ?? msg.pitch ?? 0
        let roll = msg.roll ?? 0

        if msg.source == 1 {
            upperPitch = pitch
            upperRoll = roll
        } else if msg.source == 2 {
            lowerPitch = pitch
        }
    }
}
