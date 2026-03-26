import SwiftUI

struct PrimaryButton: View {
    let title: String
    let action: () -> Void
    var isLoading: Bool = false
    var isDisabled: Bool = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .black))
                        .scaleEffect(0.8)
                }
                Text(title)
                    .font(.system(.body, design: .default, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(isDisabled ? Color.accentGreen.opacity(0.4) : Color.accentGreen)
            .foregroundColor(.black)
            .cornerRadius(12)
        }
        .disabled(isDisabled || isLoading)
    }
}

struct SecondaryButton: View {
    let title: String
    let action: () -> Void
    var isLoading: Bool = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .accentGreen))
                        .scaleEffect(0.8)
                }
                Text(title)
                    .font(.system(.body, design: .default, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(Color.bgElevated)
            .foregroundColor(.accentGreen)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.accentGreen.opacity(0.3), lineWidth: 1)
            )
        }
        .disabled(isLoading)
    }
}

struct FollowButton: View {
    let isFollowing: Bool
    let action: () -> Void
    @State private var isLoading = false

    var body: some View {
        Button {
            isLoading = true
            action()
            isLoading = false
        } label: {
            HStack(spacing: 6) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: isFollowing ? .white : .accentPurple))
                        .scaleEffect(0.7)
                } else {
                    Image(systemName: isFollowing ? "checkmark" : "plus")
                        .font(.system(size: 12, weight: .bold))
                }
                Text(isFollowing ? "Following" : "Follow")
                    .font(.system(.subheadline, design: .default, weight: .semibold))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(isFollowing ? Color.accentPurple : Color.accentPurple.opacity(0.15))
            .foregroundColor(isFollowing ? .white : .accentPurple)
            .cornerRadius(20)
        }
        .disabled(isLoading)
    }
}

struct CopyButton: View {
    let ticker: String
    let action: () -> Void
    @State private var isLoading = false
    @State private var didCopy = false

    var body: some View {
        Button {
            isLoading = true
            action()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                isLoading = false
                didCopy = true
            }
        } label: {
            HStack(spacing: 6) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .black))
                        .scaleEffect(0.7)
                } else {
                    Image(systemName: didCopy ? "checkmark" : "arrow.triangle.2.circlepath")
                        .font(.system(size: 12, weight: .bold))
                    Text(didCopy ? "Copied!" : "Copy")
                        .font(.system(.subheadline, design: .default, weight: .semibold))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(didCopy ? Color.accentGreen : Color.accentGreen.opacity(0.15))
            .foregroundColor(didCopy ? .black : .accentGreen)
            .cornerRadius(20)
        }
        .disabled(isLoading)
    }
}
