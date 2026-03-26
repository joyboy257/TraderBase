import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tabItem {
                    Image(systemName: "house.fill")
                    Text("Dashboard")
                }
                .tag(0)

            SignalsView()
                .tabItem {
                    Image(systemName: "waveform.path.ecg")
                    Text("Signals")
                }
                .tag(1)

            TradersView()
                .tabItem {
                    Image(systemName: "person.2.fill")
                    Text("Traders")
                }
                .tag(2)

            PortfolioView()
                .tabItem {
                    Image(systemName: "chart.pie.fill")
                    Text("Portfolio")
                }
                .tag(3)

            SettingsView()
                .tabItem {
                    Image(systemName: "gearshape.fill")
                    Text("Settings")
                }
                .tag(4)
        }
        .tint(.accentGreen)
    }
}
