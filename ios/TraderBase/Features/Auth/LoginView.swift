import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var email = ""
    @State private var isLoading = false
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var showMagicLinkSent = false

    var body: some View {
        ZStack {
            Color.bgBase.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 40) {
                    Spacer().frame(height: 60)

                    // Logo + Title
                    VStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(Color.accentGreen.opacity(0.1))
                                .frame(width: 80, height: 80)
                            Image(systemName: "chart.line.uptrend.xyaxis")
                                .font(.system(size: 36, weight: .bold))
                                .foregroundColor(.accentGreen)
                        }
                        VStack(spacing: 8) {
                            Text("TraderBase")
                                .font(.system(.largeTitle, design: .default, weight: .bold))
                                .foregroundColor(.textPrimary)
                            Text("Copy the best traders. Build your portfolio.")
                                .font(.system(.subheadline, design: .default))
                                .foregroundColor(.textSecondary)
                                .multilineTextAlignment(.center)
                        }
                    }

                    // Login Form
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Email")
                                .font(.system(.subheadline, design: .default, weight: .medium))
                                .foregroundColor(.textSecondary)
                            TextField("", text: $email)
                                .textFieldStyle(TraderBaseTextFieldStyle())
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                                .autocorrectionDisabled()
                        }

                        PrimaryButton(title: "Sign In with Magic Link", action: {
                            Task { await signInWithEmail() }
                        }, isLoading: isLoading, isDisabled: email.isEmpty)
                        .padding(.top, 8)

                        HStack {
                            Rectangle()
                                .fill(Color.textSecondary.opacity(0.3))
                                .frame(height: 1)
                            Text("or")
                                .font(.system(.caption, design: .default))
                                .foregroundColor(.textSecondary)
                            Rectangle()
                                .fill(Color.textSecondary.opacity(0.3))
                                .frame(height: 1)
                        }

                        SecondaryButton(title: "Continue with Google", action: {
                            Task { await signInWithGoogle() }
                        })
                    }
                    .padding(24)
                    .background(Color.bgSurface)
                    .cornerRadius(20)

                    // Features list
                    VStack(alignment: .leading, spacing: 12) {
                        FeatureRow(icon: "person.2.fill", text: "Follow top traders in real-time")
                        FeatureRow(icon: "arrow.triangle.2.circlepath", text: "Auto-copy trades with one tap")
                        FeatureRow(icon: "bell.fill", text: "Live alerts on positions & signals")
                    }
                    .padding(.horizontal, 8)

                    Spacer()
                }
                .padding(.horizontal, 24)
            }
        }
        .alert("Error", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
        .sheet(isPresented: $showMagicLinkSent) {
            MagicLinkSentView(email: email)
        }
    }

    private func signInWithEmail() async {
        isLoading = true
        do {
            try await authManager.signInWithEmail(email: email)
            showMagicLinkSent = true
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
        isLoading = false
    }

    private func signInWithGoogle() async {
        isLoading = true
        do {
            try await authManager.signInWithGoogle()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
        isLoading = false
    }
}

struct FeatureRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.accentGreen)
                .frame(width: 24)
            Text(text)
                .font(.system(.subheadline, design: .default))
                .foregroundColor(.textSecondary)
        }
    }
}

struct MagicLinkSentView: View {
    let email: String
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ZStack {
            Color.bgBase.ignoresSafeArea()
            VStack(spacing: 24) {
                ZStack {
                    Circle()
                        .fill(Color.accentGreen.opacity(0.1))
                        .frame(width: 80, height: 80)
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 32))
                        .foregroundColor(.accentGreen)
                }
                VStack(spacing: 12) {
                    Text("Check your email")
                        .font(.system(.title2, design: .default, weight: .bold))
                        .foregroundColor(.textPrimary)
                    Text("We sent a magic link to\n\(email)")
                        .font(.system(.subheadline, design: .default))
                        .foregroundColor(.textSecondary)
                        .multilineTextAlignment(.center)
                }
                SecondaryButton(title: "Close", action: { dismiss() })
                    .padding(.horizontal, 40)
            }
            .padding(32)
        }
    }
}

struct TraderBaseTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(14)
            .background(Color.bgElevated)
            .foregroundColor(.textPrimary)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.textSecondary.opacity(0.2), lineWidth: 1)
            )
    }
}
