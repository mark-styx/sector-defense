import UIKit
import Capacitor

// iOS 26 WKWebView renders edge-to-edge but does not propagate safe-area
// insets to CSS env() (Capacitor 8 / Xcode 27). Inject the native insets as
// CSS custom properties + explicit #safe-insets probe geometry, which the
// game's updateSafeAreas() already consumes; dispatch resize so it reflows.
class SafeAreaBridgeViewController: CAPBridgeViewController {
    private var appliedKey = ""

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        injectInsets()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // Layout may settle before the webview finishes loading; retry.
        for delay in [0.0, 0.5, 2.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.injectInsets()
            }
        }
    }

    private func injectInsets() {
        guard let webView = bridge?.webView, !webView.isLoading else { return }
        let i = view.safeAreaInsets
        guard i != .zero else { return }
        let key = "\(i.top),\(i.bottom),\(i.left),\(i.right)"
        guard key != appliedKey else { return }
        let js = """
        (function(){var p=document.getElementById('safe-insets');if(!p)return;
        var s=document.documentElement.style;
        s.setProperty('--sat','\(i.top)px');s.setProperty('--sab','\(i.bottom)px');
        s.setProperty('--sal','\(i.left)px');s.setProperty('--sar','\(i.right)px');
        p.style.top='\(i.top)px';p.style.right='\(i.right)px';
        p.style.bottom='\(i.bottom)px';p.style.left='\(i.left)px';
        window.dispatchEvent(new Event('resize'));})();
        """
        webView.evaluateJavaScript(js) { [weak self] _, error in
            if error == nil { self?.appliedKey = key }
        }
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
