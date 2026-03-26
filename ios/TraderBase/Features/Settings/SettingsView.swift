import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var showSignOutConfirm = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgBase.ignoresSafeArea()
                List {
                    // Profile Section
                    Section {
                        if let user = authManager.currentUser {
                            HStack(spacing: 14) {
                                TraderAvatar(
                                    avatarUrl: user.avatarUrl,
                                    displayName: user.displayName ?? user.username ?? "U",
                                    size: 52
                                )
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(user.displayName ?? user.username ?? "User")
                                        .font(.system(.body, design: .default, weight: .semibold))
                                        .foregroundColor(.textPrimary)
                                    Text(user.email ?? "")
                                        .font(.system(.caption, design: .default))
                                        .foregroundColor(.textSecondary)
                                }
                            }
                            .padding(.vertical, 8)
                        }
                    }
                    .listRowBackground(Color.bgSurface)

                    // Copy Trading Section
                    Section(header: Text("Copy Trading").foregroundColor(.textSecondary)) {
                        NavigationLink(destination: CopyTradingSettingsView()) {
                            SettingsRow(icon: "arrow.triangle.2.circlepath", title: "Copy Settings", color: .accentPurple)
                        }
                        NavigationLink(destination: BrokerageSettingsView()) {
                            SettingsRow(icon: "building.columns", title: "Brokerage Connections", color: .accentGreen)
                        }
                    }
                    .listRowBackground(Color.bgSurface)

                    // Account Section
                    Section(header: Text("Account").foregroundColor(.textSecondary)) {
                        NavigationLink(destination: ProfileSettingsView()) {
                            SettingsRow(icon: "person", title: "Edit Profile", color: .blue)
                        }
                        NavigationLink(destination: NotificationsSettingsView()) {
                            SettingsRow(icon: "bell", title: "Notifications", color: .orange)
                        }
                    }
                    .listRowBackground(Color.bgSurface)

                    // Danger Zone
                    Section(header: Text("").foregroundColor(.clear)) {
                        Button {
                            showSignOutConfirm = true
                        } label: {
                            HStack {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                    .foregroundColor(.colorSell)
                                    .frame(width: 28)
                                Text("Sign Out")
                                    .foregroundColor(.colorSell)
                            }
                        }
                    }
                    .listRowBackground(Color.bgSurface)
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.bgBase, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .alert("Sign Out", isPresented: $showSignOutConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Sign Out", role: .destructive) {
                    Task { await authManager.signOut() }
                }
            } message: {
                Text("Are you sure you want to sign out?")
            }
        }
    }
}

struct SettingsRow: View {
    let icon: String
    let title: String
    let color: Color

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(color)
                .frame(width: 28)
            Text(title)
                .font(.system(.body, design: .default))
                .foregroundColor(.textPrimary)
        }
    }
}

struct CopyTradingSettingsView: View {
    @State private var copyRatio: Double = 1.0
    @State private var maxPosition: Double = 1000
    @State private var autoCopyEnabled = false
    @State private var isSaving = false

    var body: some View {
        ZStack {
            Color.bgBase.ignoresSafeArea()
            List {
                Section(header: Text("Auto-Copy").foregroundColor(.textSecondary)) {
                    Toggle(isOn: $autoCopyEnabled) {
                        Text("Enable Auto-Copy")
                            .foregroundColor(.textPrimary)
                    }
                    .tint(.accentGreen)
                }
                .listRowBackground(Color.bgSurface)

                Section(header: Text("Defaults").foregroundColor(.textSecondary)) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Copy Ratio")
                            Spacer()
                            Text("\(Int(copyRatio * 100))%")
                                .foregroundColor(.accentGreen)
                        }
                        Slider(value: $copyRatio, in: 0.01...2.0, step: 0.01)
                            .tint(.accentGreen)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Max Position Size")
                            Spacer()
                            Text("$\(Int(maxPosition))")
                                .foregroundColor(.accentGreen)
                        }
                        Slider(value: $maxPosition, in: 100...50000, step: 100)
                            .tint(.accentGreen)
                    }
                }
                .listRowBackground(Color.bgSurface)

                Section {
                    PrimaryButton(title: "Save Changes", action: {
                        Task { await saveSettings() }
                    }, isLoading: isSaving)
                }
                .listRowBackground(Color.clear)
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Copy Trading")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func saveSettings() async {
        isSaving = true
        // TODO: Call Supabase to update copy settings
        try? await Task.sleep(nanoseconds: 500_000_000)
        isSaving = false
    }
}

struct BrokerageSettingsView: View {
    @State private var connections: [BrokerageConnectionRow] = []

    var body: some View {
        ZStack {
            Color.bgBase.ignoresSafeArea()
            if connections.isEmpty {
                EmptyStateView(
                    icon: "building.columns",
                    title: "No brokerages",
                    message: "Connect a brokerage to enable copy trading"
                )
            } else {
                List {
                    ForEach(connections) { connection in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(connection.brokerageName)
                                    .font(.system(.body, design: .default, weight: .medium))
                                    .foregroundColor(.textPrimary)
                                Text(connection.status)
                                    .font(.system(.caption, design: .default))
                                    .foregroundColor(.textSecondary)
                            }
                            Spacer()
                            Button("Disconnect") {
                                // TODO
                            }
                            .font(.system(.caption, design: .default, weight: .medium))
                            .foregroundColor(.colorSell)
                        }
                        .listRowBackground(Color.bgSurface)
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Brokerages")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                NavigationLink(destination: ConnectBrokerageView()) {
                    Image(systemName: "plus")
                        .foregroundColor(.accentGreen)
                }
            }
        }
    }
}

struct BrokerageConnectionRow: Identifiable {
    let id: String
    let brokerageName: String
    let status: String
}

struct ConnectBrokerageView: View {
    var body: some View {
        ZStack {
            Color.bgBase.ignoresSafeArea()
            VStack(spacing: 24) {
                Text("Connect your brokerage")
                    .font(.system(.headline, design: .default))
                    .foregroundColor(.textPrimary)
                // Plaid Link would be opened here
                Text("Plaid Link integration")
                    .foregroundColor(.textSecondary)
                Spacer()
            }
            .padding(24)
        }
        .navigationTitle("Connect Brokerage")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ProfileSettingsView: View {
    @State private var displayName = ""
    @State private var username = ""
    @State private var bio = ""
    @State private var isSaving = false

    var body: some View {
        ZStack {
            Color.bgBase.ignoresSafeArea()
            List {
                Section(header: Text("Display Name").foregroundColor(.textSecondary)) {
                    TextField("", text: $displayName)
                        .foregroundColor(.textPrimary)
                }
                .listRowBackground(Color.bgSurface)
                Section(header: Text("Username").foregroundColor(.textSecondary)) {
                    TextField("", text: $username)
                        .foregroundColor(.textPrimary)
                        .autocapitalization(.none)
                }
                .listRowBackground(Color.bgSurface)
                Section(header: Text("Bio").foregroundColor(.textSecondary)) {
                    TextEditor(text: $bio)
                        .frame(minHeight: 80)
                        .foregroundColor(.textPrimary)
                }
                .listRowBackground(Color.bgSurface)
                Section {
                    PrimaryButton(title: "Save Changes", action: {
                        Task { await saveProfile() }
                    }, isLoading: isSaving)
                }
                .listRowBackground(Color.clear)
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Edit Profile")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func saveProfile() async {
        isSaving = true
        // TODO: Call Supabase to update profile
        try? await Task.sleep(nanoseconds: 500_000_000)
        isSaving = false
    }
}

struct NotificationsSettingsView: View {
    @State private var signalAlerts = true
    @State private var tradeAlerts = true
    @State private var followerAlerts = false

    var body: some View {
        ZStack {
            Color.bgBase.ignoresSafeArea()
            List {
                Section(header: Text("").foregroundColor(.textSecondary)) {
                    Toggle("New signals from followed traders", isOn: $signalAlerts)
                        .tint(.accentGreen)
                    Toggle("Trade executions", isOn: $tradeAlerts)
                        .tint(.accentGreen)
                    Toggle("New followers", isOn: $followerAlerts)
                        .tint(.accentGreen)
                }
                .listRowBackground(Color.bgSurface)
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
    }
}
