import SwiftUI

// MARK: - Color Extension
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    static let bgBase = Color(hex: "0A0A0F")
    static let bgSurface = Color(hex: "12121A")
    static let bgElevated = Color(hex: "1A1A25")
    static let accentGreen = Color(hex: "32FF48")
    static let accentPurple = Color(hex: "6F2BFF")
    static let colorBuy = Color(hex: "32FF48")
    static let colorSell = Color(hex: "FF4757")
    static let textPrimary = Color(hex: "F0F0F5")
    static let textSecondary = Color(hex: "A0A0AA")
}

// MARK: - Ticker Badge
struct TickerBadge: View {
    let ticker: String

    var body: some View {
        Text(ticker)
            .font(.system(.caption, design: .monospaced, weight: .bold))
            .foregroundColor(.accentGreen)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.accentGreen.opacity(0.15))
            .cornerRadius(6)
    }
}

// MARK: - Action Badge
struct ActionBadge: View {
    let action: SignalAction

    var body: some View {
        Text(action.rawValue)
            .font(.system(.caption, design: .default, weight: .bold))
            .foregroundColor(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(action == .BUY ? Color.colorBuy : Color.colorSell)
            .cornerRadius(6)
    }
}

// MARK: - Trader Avatar
struct TraderAvatar: View {
    let avatarUrl: String?
    let displayName: String
    let size: CGFloat

    var body: some View {
        if let urlString = avatarUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                initialsView
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
        } else {
            initialsView
        }
    }

    private var initialsView: some View {
        ZStack {
            Circle()
                .fill(Color.accentPurple.opacity(0.3))
            Text(String(displayName.prefix(1)).uppercased())
                .font(.system(size: size * 0.4, weight: .bold, design: .default))
                .foregroundColor(.accentPurple)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Loading Overlay
struct LoadingOverlay: View {
    let message: String

    var body: some View {
        ZStack {
            Color.black.opacity(0.6)
                .ignoresSafeArea()
            VStack(spacing: 16) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .accentGreen))
                    .scaleEffect(1.2)
                Text(message)
                    .font(.system(.subheadline, design: .default, weight: .medium))
                    .foregroundColor(.textSecondary)
            }
            .padding(24)
            .background(Color.bgElevated)
            .cornerRadius(16)
        }
    }
}

// MARK: - Empty State
struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(.textSecondary.opacity(0.5))
            VStack(spacing: 8) {
                Text(title)
                    .font(.system(.headline, design: .default, weight: .semibold))
                    .foregroundColor(.textPrimary)
                Text(message)
                    .font(.system(.subheadline, design: .default))
                    .foregroundColor(.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(40)
    }
}
