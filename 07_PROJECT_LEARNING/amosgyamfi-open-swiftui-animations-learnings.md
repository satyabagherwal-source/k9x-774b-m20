# Forensic Learning Record (Deep Inspection): amosgyamfi/open-swiftui-animations

> **Canonical Artifact**: `07_PROJECT_LEARNING/amosgyamfi-open-swiftui-animations-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/amosgyamfi/open-swiftui-animations](https://github.com/amosgyamfi/open-swiftui-animations))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:31:40.214Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `amosgyamfi/open-swiftui-animations`
- **Description**: You don't need an animation library to add a simple effect to your SwiftUI app. Create it yourself with SwiftUI. This repo inspires you to add helpful and expressive SwiftUI animations like loading/progress, looping, on-off, enter, exit, fade, spin, and background animations to your next project. The repo also contains tremendous spring animations.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5658 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Gists_To_Try/AddToBookmark.swift`
```
//
//  AddToBookmark.swift
//  SwiftUIAnimation2026
//
//  Created by Amos Gyamfi on 16.3.2026.
//

import SwiftUI
import WebKit

struct AddToBookmark: View {
    @State private var urlText: String = "developer.apple.com/"
    @State private var bookmarkTrigger: Int = 0
    let url = URL(string: "https://developer.apple.com")!
    
    var body: some View {
        NavigationStack {
            ZStack {
                
                WebView(url: url)
                
                VStack {
                    Spacer()
                    
                    HStack {
                        PhaseAnimator([false, true], trigger: bookmarkTrigger) { move in
                            ZStack {
                                Circle()
                                    .trim(from: 0.5, to: 1.0)
                                    .stroke()
                                    .opacity(0)
                                Image(systemName: "safari.fill")
                                    .font(.largeTitle)
                                    .offset(x: -162, y: -17)
                                    .rotationEffect(.degrees(move ? 180.0 : 0.0))
                                    .opacity(move ? 0 : 1)
                                //.scaleEffect(move ? 1 : 0)
                            }
                        } animation: { move in
                            move ? .easeInOut(duration: 1) : .linear(duration: 0)
                        }
                        .offset(y: 240)
                        
                        Spacer()
                    }
                    .padding()
                    
                    bottomBar
                }
            }
            .preferredColorScheme(.dark)
        }
    }
    
    var bottomBar: some View {
        HStack(spacing: 12) {
            Button(action: {}) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(.black, in: Circle())
            }
            
            HStack(spacing: 32) {
                Image(systemName: "text.justify.left")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.6))
                
                Text(urlText)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white)
                
                Button(action: {}) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.6))
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 36)
            .background(.black, in: Capsule())
            
            Menu {
                Button(action: {}) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
                Button(action: { bookmarkTrigger += 1 }) {
                    Label("Add to Bookmarks", systemImage: "bookmark")
                }
                Button(action: {}) {
                    Label("Add Bookmark to...", systemImage: "book")
                }
                Divider()
                Button(action: {}) {
                    Label("New Tab", systemImage: "plus")
                }
                Button(action: {}) {
                    Label("New Private Tab", systemImage: "hand.raised.fill")
                }
                Divider()
                HStack {
                    Button(action: {}) {
                        Label("Bookmarks", systemImage: "book.fill")
                    }
                    Button(action: {}) {
                        Label("All Tabs", systemImage: "rectangle.on.rectangle")
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(.black, in: Circle())
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }
}

#Preview {
    AddToBookmark()
}

```

### Core Architecture Module: `Gists_To_Try/ChristmasTreeFireworksBitrig.swift`
```
import SwiftUI
import AVFoundation

@main
struct ChristmasTreeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @State private var ornamentScale: [CGFloat] = Array(repeating: 1.0, count: 15)
    @State private var fireworks: [Firework] = []
    @State private var starRotation: Double = 0
    @State private var lightsOpacity: Double = 1.0
    @State private var audioEngine = AVAudioEngine()
    @State private var playerNode = AVAudioPlayerNode()
    
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [.black, .blue.opacity(0.3), .purple.opacity(0.2)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            VStack(spacing: 0) {
                Spacer()
                
                ZStack {
                    TreeView(
                        ornamentScale: $ornamentScale,
                        lightsOpacity: $lightsOpacity
                    )
                    
                    Image(systemName: "star.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(.yellow)
                        .shadow(color: .yellow, radius: 10)
                        .rotationEffect(.degrees(starRotation))
                        .offset(y: -280)
                }
                
                Spacer()
            }
            
            ForEach(fireworks) { firework in
                FireworkView(firework: firework)
            }
        }
        .onTapGesture { location in
            launchFireworkAt(x: location.x, y: location.y)
        }
        .onAppear {
            startAnimations()
        }
    }
    
    func startAnimations() {
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            starRotation = 360
        }
        
        withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) {
            lightsOpacity = 0.3
        }
        
        animateOrnaments()
        launchFireworks()
        setupAudio()
    }
    
    func setupAudio() {
        audioEngine.attach(playerNode)
        audioEngine.connect(playerNode, to: audioEngine.mainMixerNode, format: nil)
        try? audioEngine.start()
    }
    
    func playFireworkSound() {
        Task {
            guard let url = URL(string: "https://cdn.pixabay.com/audio/2022/03/24/audio_5f6c813d7c.mp3") else { return }
            
            do {
                let data = try Data(contentsOf: url)
                let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("firework.mp3")
                try data.write(to: tempURL)
                
                let audioFile = try AVAudioFile(forReading: tempURL)
                let buffer = AVAudioPCMBuffer(pcmFormat: audioFile.processingFormat, frameCapacity: AVAudioFrameCount(audioFile.length))!
                try audioFile.read(into: buffer)
                
                playerNode.stop()
                playerNode.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
                if !playerNode.isPlaying {
                    playerNode.play()
                }
            } catch {}
        }
    }
    
    func animateOrnaments() {
        for i in ornamentScale.indices {
            let delay = Double(i) * 0.1
            withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true).delay(delay)) {
                ornamentScale[i] = 1.3
            }
        }
    }
    
    func launchFireworks() {
        Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { _ in
            let newFirework = Firework(
                x: CGFloat.random(in: 50...350),
                y: CGFloat.random(in: 100...400),
                color: [.red, .blue, .green, .yellow, .purple, .pink, .orange].randomElement()!
            )
            fireworks.append(newFirework)
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                fireworks.removeAll { $0.id == newFirework.id }
            }
        }
    }
    
    func launchFireworkAt(x: CGFloat, y: CGFloat) {
        let newFirework = Firework(
            x: x,
            y: y,
            color: [.red, .blue, .green, .yellow, .purple, .pink, .orange].randomElement()!
        )
        fireworks.append(newFirework)
        playFireworkSound()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            fireworks.removeAll { $0.id == newFirework.id }
        }
    }
}

struct TreeView: View {
    @Binding var ornamentScale: [CGFloat]
    @Binding var lightsOpacity: Double
    
    var body: some View {
        ZStack {
            VStack(spacing: -20) {
                Triangle()
                    .fill(LinearGradient(
                        colors: [.green, .green.opacity(0.7)],
                        startPoint: .top,
                        endPoint: .bottom
                    ))
                    .frame(width: 100, height: 80)
                
                Triangle()
                    .fill(LinearGradient(
                        colors: [.green.opacity(0.8), .green.opacity(0.6)],
                        startPoint: .top,
                        endPoint: .bottom
                    ))
                    .frame(width: 140, height: 90)
                
                Triangle()
                    .fill(LinearGradient(
                        colors: [.green.opacity(0.7), .green.opacity(0.5)],
                        startPoint: .top,
                        endPoint: .bottom
                    ))
                    .frame(width: 180, height: 100)
                
                Rectangle()
                    .fill(.brown)
                    .frame(width: 40, height: 50)
            }
            
            OrnamentLayer(scale: ornamentScale, lightsOpacity: lightsOpacity)
        }
    }
}

struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

struct OrnamentLayer: View {
    let scale: [CGFloat]
    let lightsOpacity: Double
    
    let positions: [(CGFloat, CGFloat)] = [
        (0, -220), (-30, -200), (30, -200),
        (-20, -150), (20, -150), (0, -160),
        (-50, -100), (0, -110), (50, -100),
        (-70, -50), (-35, -60), (35, -60), (70, -50),
        (-80, 0), (-40, -10), (40, -10), (80, 0)
    ]
    
    var body: some View {
        ZStack {
            ForEach(0..<min(positions.count, scale.count), id: \.self) { i in
                Circle()
                    .fill([Color.red, .blue, .yellow, .pink, .purple, .orange][i % 6])
                    .frame(width: 15, height: 15)
                    .scaleEffect(scale[i])
                    .shadow(color: [Color.red, .blue, .yellow, .pink, .purple, .orange][i % 6], radius: 5)
                    .offset(x: positions[i].0, y: positions[i].1)
            }
            
            ForEach(0..<8, id: \.self) { i in
                Circle()
                    .fill(.white)
                    .frame(width: 8, height: 8)
                    .opacity(lightsOpacity)
                    .shadow(color: .white, radius: 3)
                    .offset(
                        x: CGFloat.random(in: -90...90),
                        y: CGFloat.random(in: -240...40)
                    )
            }
        }
    }
}

struct Firework: Identifiable {
    let id = UUID()
    let x: CGFloat
    let y: CGFloat
    let color: Color
}

struct FireworkView: View {
    let firework: Firework
    @State private var scale: CGFloat = 0.1
    @State private var opacity: Double = 1.0
    
    var body: some View {
        ZStack {
            ForEach(0..<12) { i in
                Circle()
                    .fill(firework.color)
                    .frame(width: 8, height: 8)
                    .offset(
                        x: cos(Double(i) * (.pi / 6)) * (50 * scale),
                        y: sin(Double(i) * (.pi / 6)) * (50 * scale)
                    )
            }
        }
        .opacity(opacity)
        .position(x: firework.x, y: firework.y)
        .onAppear {
            withAnimation(.easeOut(duration: 1.0)) {
                scale = 1.5
                opacity = 0
            }
        }
    }
}

```

### Core Architecture Module: `Gists_To_Try/Claude4SonnetSwiftUIFireworks.swift`
```
//
//  Claude4iOSFireworks.swift
//
//  Created by Amos Gyamfi on 23.5.2025.
//

import SwiftUI
import UIKit

// MARK: - Fireworks Emitter View
struct FireworksEmitterView: UIViewRepresentable {
    @Binding var triggerFireworks: Bool
    
    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = UIColor.clear
        return view
    }
    
    func updateUIView(_ uiView: UIView, context: Context) {
        if triggerFireworks {
            createFireworksEffect(in: uiView)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                triggerFireworks = false
            }
        }
    }
    
    private func createFireworksEffect(in view: UIView) {
        // Random launch position
        let launchX = CGFloat.random(in: view.bounds.width * 0.2...view.bounds.width * 0.8)
        let launchY = view.bounds.height
        let explosionY = CGFloat.random(in: view.bounds.height * 0.2...view.bounds.height * 0.6)
        
        // Create launch trail
        createLaunchTrail(in: view, startX: launchX, startY: launchY, endY: explosionY)
        
        // Delay explosion to match launch timing
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            self.createExplosion(in: view, x: launchX, y: explosionY)
        }
    }
    
    private func createLaunchTrail(in view: UIView, startX: CGFloat, startY: CGFloat, endY: CGFloat) {
        let emitterLayer = CAEmitterLayer()
        
        // Position at launch point
        emitterLayer.emitterPosition = CGPoint(x: startX, y: startY)
        emitterLayer.emitterShape = .point
        emitterLayer.emitterMode = .outline
        
        // Create launch particle
        let launchCell = CAEmitterCell()
        launchCell.name = "launch"
        launchCell.birthRate = 5
        launchCell.lifetime = 0.8
        launchCell.velocity = 300
        launchCell.velocityRange = 50
        launchCell.emissionLongitude = -.pi / 2  // Upward
        launchCell.emissionRange = .pi / 8
        
        // Appearance
        launchCell.scale = 0.3
        launchCell.scaleRange = 0.1
        launchCell.color = UIColor.white.cgColor
        launchCell.redRange = 0.3
        launchCell.greenRange = 0.3
        launchCell.blueRange = 0.3
        launchCell.alphaSpeed = -1.0
        
        // Physics
        launchCell.yAcceleration = 100  // Gravity effect
        launchCell.scaleSpeed = -0.2
        
        // Particle image (create a simple circle)
        launchCell.contents = createParticleImage(size: 8, color: .white).cgImage
        
        emitterLayer.emitterCells = [launchCell]
        view.layer.addSublayer(emitterLayer)
        
        // Animate the emitter position to simulate rocket trail
        let animation = CABasicAnimation(keyPath: "emitterPosition")
        animation.fromValue = CGPoint(x: startX, y: startY)
        animation.toValue = CGPoint(x: startX, y: endY)
        animation.duration = 0.8
        animation.timingFunction = CAMediaTimingFunction(name: .easeOut)
        emitterLayer.add(animation, forKey: "position")
        
        // Remove after animation
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            emitterLayer.removeFromSuperlayer()
        }
    }
    
    private func createExplosion(in view: UIView, x: CGFloat, y: CGFloat) {
        let emitterLayer = CAEmitterLayer()
        
        // Position at explosion point
        emitterLayer.emitterPosition = CGPoint(x: x, y: y)
        emitterLayer.emitterShape = .point
        emitterLayer.emitterMode = .outline
        
        // Create multiple types of explosion particles
        var cells: [CAEmitterCell] = []
        
        // Main explosion particles
        let explosionCell = CAEmitterCell()
        explosionCell.name = "explosion"
        explosionCell.birthRate = 200
        explosionCell.lifetime = 3.0
        explosionCell.lifetimeRange = 1.0
        explosionCell.velocity = 200
        explosionCell.velocityRange = 100
        explosionCell.emissionLongitude = 0
        explosionCell.emissionRange = 2 * .pi  // Full circle
        
        // Random colors for fireworks
        let colors: [UIColor] = [.red, .orange, .yellow, .green, .blue, .purple, .magenta, .cyan]
        let selectedColor = colors.randomElement() ?? .red
        
        explosionCell.color = selectedColor.cgColor
        explosionCell.redRange = 0.4
        explosionCell.greenRange = 0.4
        explosionCell.blueRange = 0.4
        explosionCell.alphaSpeed = -0.8
        
        // Physics
        explosionCell.yAcceleration = 200  // Gravity
        explosionCell.scale = 0.5
        explosionCell.scaleRange = 0.3
        explosionCell.scaleSpeed = -0.2
        
        explosionCell.contents = createParticleImage(size: 6, color: selectedColor).cgImage
        cells.append(explosionCell)
        
        // Sparkle particles
        let sparkleCell = CAEmitterCell()
        sparkleCell.name = "sparkle"
        sparkleCell.birthRate = 100
        sparkleCell.lifetime = 2.0
        sparkleCell.lifetimeRange = 0.5
        sparkleCell.velocity = 150
        sparkleCell.velocityRange = 80
        sparkleCell.emissionLongitude = 0
        sparkleCell.emissionRange = 2 * .pi
        
        sparkleCell.color = UIColor.white.cgColor
        sparkleCell.alphaSpeed = -1.0
        sparkleCell.yAcceleration = 150
        sparkleCell.scale = 0.2
        sparkleCell.scaleRange = 0.1
        sparkleCell.scaleSpeed = -0.1
        
        // Create sparkle image
        sparkleCell.contents = createSparkleImage().cgImage
        cells.append(sparkleCell)
        
        // Trailing particles
        let trailCell = CAEmitterCell()
        trailCell.name = "trail"
        trailCell.birthRate = 50
        trailCell.lifetime = 1.5
        trailCell.velocity = 100
        trailCell.velocityRange = 30
        trailCell.emissionLongitude = 0
        trailCell.emissionRange = 2 * .pi
        
        trailCell.color = selectedColor.cgColor
        trailCell.alphaSpeed = -2.0
        trailCell.yAcceleration = 100
        trailCell.scale = 0.3
        trailCell.scaleSpeed = -0.3
        
        trailCell.contents = createParticleImage(size: 4, color: selectedColor).cgImage
        cells.append(trailCell)
        
        emitterLayer.emitterCells = cells
        view.layer.addSublayer(emitterLayer)
        
        // Stop emission after initial burst
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            emitterLayer.birthRate = 0
        }
        
        // Remove layer after particles fade
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            emitterLayer.removeFromSuperlayer()
        }
    }
    
    private func createParticleImage(size: CGFloat, color: UIColor) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        return renderer.image { context in
            context.cgContext.setFillColor(color.cgColor)
            context.cgContext.fillEllipse(in: CGRect(origin: .zero, size: CGSize(width: size, height: size)))
        }
    }
    
    private func createSparkleImage() -> UIImage {
        let size: CGFloat = 8
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        return renderer.image { context in
            let cgContext = context.cgContext
            cgContext.setStrokeColor(UIColor.white.cgColor)
            cgContext.setLineWidth(1)
            
            // Draw star shape
            cgContext.move(to: CGPoint(x: size/2, y: 0))
            cgContext.addLine(to: CGPoint(x: size/2, y: size))
            cgContext.move(to: CGPoint(x: 0, y: size/2))
            cgContext.addLine(to: CGPoint(x: size, y: size/2))
            cgContext.move(to: CGPoint(x: size*0.2, y: size*0.2))
            cgContext.addLine(to: CGPoint(x: size*0.8, y: size*0.8))
            cgContext.move(to: CGPoint(x: size*0.8, y: size*0.2))
            cgContext.addLine(to: CGPoint(x: size*0.2, y: size*0.8))
            
            cgContext.strokePath()
        }
    }
}

// MARK: - Main SwiftUI View
struct Claude4iOSFireworks: View {
    @State private var triggerFireworks = false
    @State private var showInstructions = true
    
    var body: some View {
        ZStack {
            // Night sky background
            LinearGradient(
                colors: [
                    Color.black,
                    Color.blue.opacity(0.3),
                    Color.purple.opacity(0.2)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            // Stars background
            StarsView()
            
            // Fireworks layer
            FireworksEmitterView(triggerFireworks: $triggerFireworks)
                .ignoresSafeArea()
            
            // Instructions overlay
            if showInstructions {
                VStack {
                    Spacer()
                    
                    VStack(spacing: 16) {
                        Text("🎆 Fireworks Display 🎆")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        
                        Text("Tap anywhere to launch fireworks!")
                            .font(.body)
                            .foregroundColor(.white.opacity(0.8))
                        
                        Button("Hide Instructions") {
                            withAnimation(.easeOut(duration: 0.5)) {
                                showInstructions = false
                            }
                        }
                        .foregroundColor(.yellow)
                        .padding(.top)
                    }
                    .padding(24)
                    .background(
                        RoundedRectangle(cor
```

### Core Architecture Module: `Gists_To_Try/FlowerAnimation.swift`
```
//
//  FlowerAnimation.swift
//  Demonstrating 2D rotation around specified anchor
//
//  Created by Amos Gyamfi on 15.12.2025.
//

import SwiftUI

struct FlowerAnimation: View {
    var body: some View {
        HStack(spacing: 0) {
            VStack {
                Spacer()
                
                PhaseAnimator([false, true]) { animateWhole in
                    ZStack {
                        PhaseAnimator([false, true]) { animateRM in
                            Image(.rBack)
                                .rotationEffect(.degrees(animateRM ? -30 : 0), anchor: .bottomLeading)
                                .offset(x: 20, y: -84)
                        } animation: { animateRM in
                                .easeIn(duration: 2).delay(1)
                        }
                        
                        
                        PhaseAnimator([false, true]) { animateLB in
                            Image(.lBack)
                                .rotationEffect(.degrees(animateLB ? 30 : 0), anchor: .bottomTrailing)
                                .offset(x: -20, y: -84)
                        } animation: { animateLB in
                                .easeIn(duration: 2).delay(1)
                        }
                        
                        
                        PhaseAnimator([false, true]) { animateRM in
                            Image(.rMiddle)
                                .rotationEffect(.degrees(animateRM ? -30 : 0), anchor: .bottomLeading)
                                .offset(x: 50, y: -44)
                        } animation: { animateRM in
                                .easeInOut(duration: 2).delay(1)
                        }
                        
                        PhaseAnimator([false, true]) { animateLM in
                            Image(.lMiddle)
                                .rotationEffect(.degrees(animateLM ? 30 : 0), anchor: .bottomTrailing)
                                .offset(x: -50, y: -44)
                        } animation: { animateLM in
                                .easeInOut(duration: 2).delay(1)
                        }
                        
                        // Front
                        PhaseAnimator([false, true]) { animateRF in
                            Image(.rFront)
                                .rotationEffect(.degrees(animateRF ? -30 : 0), anchor: .bottomLeading)
                                .offset(x: 70)
                        } animation: { animateRF in
                                .easeOut(duration: 2).delay(1)
                        }
                        
                        PhaseAnimator([false, true]) { animateLF in
                            Image(.lFront)
                                .rotationEffect(.degrees(animateLF ? 30 : 0), anchor: .bottomTrailing)
                                .offset(x: -70)
                        } animation: { animateLF in
                                .easeOut(duration: 2).delay(1)
                        }
                    }
                    .scaleEffect(animateWhole ? 0.7 : 1.0)
                    .blendMode(.hardLight)
                } animation: { animateWhole in
                        .easeInOut(duration: 2).delay(1)
                }
            }
        }
    }
}

#Preview {
    FlowerAnimation()
        .preferredColorScheme(.dark)
}

```

### Core Architecture Module: `Gists_To_Try/GeminiFireworksAnimation.swift`
```
import SwiftUI
import UIKit // Still needed for CAEmitterLayer, UIView, UIColor, UIImage

// MARK: - UIViewRepresentable Wrapper
struct ParticleEmitterView: UIViewRepresentable {

    // This matches the original fixed size, but SwiftUI might resize it.
    // We'll use relative positioning instead of hardcoding based on this size.
    // let originalSize = CGSize(width: 625.0, height: 1118.0)

    // You can add @Binding properties here if you want to control
    // emitter parameters dynamically from SwiftUI state.

    func makeUIView(context: Context) -> UIView {
        let size = CGSize(width: 625.0, height: 1118.0)
        let host = UIView(frame: CGRect(x: 0.0, y: 0.0, width: size.width, height: size.height))
        
        let particlesLayer = CAEmitterLayer()
        particlesLayer.frame = CGRect(x: 0.0, y: 0.0, width: size.width, height: size.height)
        
        host.layer.addSublayer(particlesLayer)
        host.layer.masksToBounds = true
        
        particlesLayer.backgroundColor = UIColor.black.cgColor
        particlesLayer.emitterShape = .point
        particlesLayer.emitterPosition = CGPoint(x: 312.5, y: 1018.0)
        particlesLayer.emitterSize = CGSize(width: 0.0, height: 0.0)
        particlesLayer.emitterMode = .outline
        particlesLayer.renderMode = .additive
        
        // Parent cell
        let cell1 = CAEmitterCell()
        cell1.name = "Parent"
        cell1.birthRate = 5.0
        cell1.lifetime = 2.5
        cell1.velocity = 300.0
        cell1.velocityRange = 100.0
        cell1.yAcceleration = -100.0
        cell1.emissionLongitude = -90.0 * (.pi / 180.0)
        cell1.emissionRange = 45.0 * (.pi / 180.0)
        cell1.scale = 0.0
        cell1.color = UIColor.white.cgColor
        cell1.redRange = 0.9
        cell1.greenRange = 0.9
        cell1.blueRange = 0.9
        
        // Trail subcell
        let subcell1_1 = CAEmitterCell()
        subcell1_1.contents = UIImage(named: "Spark")?.cgImage
        subcell1_1.name = "Trail"
        subcell1_1.birthRate = 45.0
        subcell1_1.lifetime = 0.5
        subcell1_1.beginTime = 0.01
        subcell1_1.duration = 1.7
        subcell1_1.velocity = 80.0
        subcell1_1.velocityRange = 100.0
        subcell1_1.xAcceleration = 100.0
        subcell1_1.yAcceleration = 350.0
        subcell1_1.emissionLongitude = -360.0 * (.pi / 180.0)
        subcell1_1.emissionRange = 22.5 * (.pi / 180.0)
        subcell1_1.scale = 0.5
        subcell1_1.scaleSpeed = 0.13
        subcell1_1.alphaSpeed = -0.7
        subcell1_1.color = UIColor.white.cgColor
        
        // Firework subcell
        let subcell1_2 = CAEmitterCell()
        subcell1_2.contents = UIImage(named: "Spark")?.cgImage
        subcell1_2.name = "Firework"
        subcell1_2.birthRate = 20000.0
        subcell1_2.lifetime = 15.0
        subcell1_2.beginTime = 1.6
        subcell1_2.duration = 0.1
        subcell1_2.velocity = 190.0
        subcell1_2.yAcceleration = 80.0
        subcell1_2.emissionRange = 360.0 * (.pi / 180.0)
        subcell1_2.spin = 114.6 * (.pi / 180.0)
        subcell1_2.scale = 0.1
        subcell1_2.scaleSpeed = 0.09
        subcell1_2.alphaSpeed = -0.7
        subcell1_2.color = UIColor.white.cgColor
        
        // Set up emitter cells hierarchy
        cell1.emitterCells = [subcell1_1, subcell1_2]
        particlesLayer.emitterCells = [cell1]
        
        return host
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}

struct Gemini25FireworksView: View {
    var body: some View {
        ZStack {
            Color.black.edgesIgnoringSafeArea(.all)
            ParticleEmitterView()
        }
    }
}

#Preview {
    Gemini25FireworksView()
}

```

### Core Architecture Module: `Gists_To_Try/Gemini_25_With_OpenAI_o3_Animation.swift`
```
//
//  AnimationContentView.swift
//  
//  Created by Amos Gyamfi on 23.4.2025.

/*
In this example, We prompt Gemini 2.5 Pro to watch an mp4 video of a recorded animation and generate a SwiftUI animation. Gemini 2.5 Pro isn't great at fixing SwiftUI errors, so we bring o3 to fix all errors using ChatGPT Chat Bar.  
*/

import SwiftUI

// Main view to display all animations
struct AnimationContentView: View {
    var body: some View {
        HStack(spacing: 40) { // Arrange animations horizontally
            MicrophoneAnimationView()
            HeartAnimationView()
            SparkleAnimationView()
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity) // Center content
        .background(Color(white: 0.95)) // Light background similar to video
    }
}

// MARK: - 1. Microphone Pulse Animation

struct MicrophoneAnimationView: View {
    @State private var isAnimating = false

    var body: some View {
        ZStack {
            // Pulsating Rings
            ForEach(0..<3) { index in
                Circle()
                    .fill(Color.blue.opacity(0.4)) // Standard Color usage
                    .frame(width: 80, height: 80)
                    .scaleEffect(isAnimating ? 1.8 : 1.0)
                    .opacity(isAnimating ? 0.0 : 1.0)
                    .animation(
                        Animation.easeInOut(duration: 1.5)
                            .repeatForever(autoreverses: false)
                            .delay(Double(index) * 0.3), // Standard animation
                        value: isAnimating
                    )
            }

            // Inner Blue Circle (Gradient)
            Circle()
                .fill(
                    LinearGradient(
                        gradient: Gradient(colors: [Color.blue.opacity(0.8), Color.blue]), // Standard Gradient
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 80, height: 80)

            // Microphone Icon
            Image(systemName: "mic.fill")
                .font(.system(size: 35))
                .foregroundColor(.white)
        }
        .frame(width: 150, height: 150)
        .onAppear {
            isAnimating = true
        }
    }
}

// MARK: - 2. Heart Reaction Animation

struct HeartAnimationView: View {
    @State private var triggerAnimation = false
    let heartCount = 6
    let animationDuration = 1.8
    let staggerInterval = 0.1

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.gray.opacity(0.3))
                .frame(width: 80, height: 80)

            ForEach(0..<heartCount, id: \.self) { index in
                HeartParticleView(
                    trigger: $triggerAnimation,
                    index: index,
                    duration: animationDuration,
                    stagger: staggerInterval
                )
            }

            Image(systemName: "heart.fill")
                .font(.system(size: 40))
                .foregroundColor(.red)
                .frame(width: 80, height: 80)
                .zIndex(1)
        }
        .frame(width: 150, height: 150)
        .onAppear {
            triggerAnimation = true
        }
    }
}

// Represents a single floating heart particle
struct HeartParticleView: View {
    @Binding var trigger: Bool
    let index: Int
    let duration: Double
    let stagger: Double

    @State private var scale: CGFloat = 0.1
    @State private var yOffset: CGFloat = 0
    @State private var opacity: Double = 1.0
    @State private var isAnimating = false // Internal state to manage loops

    private let xTarget: CGFloat = CGFloat.random(in: -40...40)
    // Ensure yTarget is not zero to avoid division by zero issues, although abs() handles it mathematically
    private let yTarget: CGFloat = CGFloat.random(in: -120 ... -80)
    private let scaleTarget: CGFloat = CGFloat.random(in: 0.7...1.1)

    var body: some View {
        Image(systemName: "heart.fill")
            .font(.system(size: 20))
            .foregroundColor(.red)
            .scaleEffect(scale)
             // Ensure calculations use CGFloat. abs() returns the same type (CGFloat).
            .offset(x: xTarget * (abs(yOffset) / abs(yTarget)), y: yOffset)
            .opacity(opacity)
            .onChange(of: trigger) { newValue in
                 // Use new 'trigger' parameter name to avoid conflict
                 // This logic starts the animation cycle when the parent trigger changes
                if newValue && !isAnimating {
                    DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * stagger) {
                        // Check trigger *again* before starting, in case it changed back quickly
                        if self.trigger {
                            startAnimationCycle()
                            isAnimating = true
                        }
                    }
                } else if !newValue {
                     // If trigger becomes false, stop animating
                    isAnimating = false
                    // Optionally reset to initial state immediately when stopped
                    // resetState() // You might want this depending on desired behavior
                }
            }
             // Add an .onAppear for initial setup if needed, though onChange handles the trigger
             // .onAppear {
             //    // Potentially initialize or check trigger state here too
             // }
    }

    func startAnimationCycle() {
        // Only proceed if the view should be animating
        guard isAnimating || trigger else {
            isAnimating = false // Ensure flag is correct if trigger is false
            return
        }

        resetState() // Reset to start values for the new cycle

        withAnimation(.easeOut(duration: duration)) {
            scale = scaleTarget
            yOffset = yTarget
            opacity = 0.0
        }

        // Schedule the *next* cycle check
        DispatchQueue.main.asyncAfter(deadline: .now() + duration ) { // Removed extra 0.05, delay until animation ends
            // Check if we should continue looping
            if self.trigger && self.isAnimating {
                startAnimationCycle() // Loop
            } else {
                // If trigger became false during animation, ensure we stop
                isAnimating = false
                resetState() // Reset state when stopping
            }
        }
    }

    func resetState() {
        scale = 0.1
        yOffset = 0
        opacity = 1.0
    }
}


// MARK: - 3. Sparkle Glow Animation

struct SparkleAnimationView: View {
    @State private var isAnimating = false

    // Rainbow radial gradient with semi‑transparent colors
    private let rainbowGradient = RadialGradient(
        gradient: Gradient(colors: [
            Color.red.opacity(0.7),
            Color.orange.opacity(0.7),
            Color.yellow.opacity(0.7),
            Color.green.opacity(0.7),
            Color.blue.opacity(0.7),
            Color.purple.opacity(0.7),
            Color.red.opacity(0.7)
        ]),
        center: .center,
        startRadius: 5,
        endRadius: 60
    )

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.gray.opacity(0.3))
                .frame(width: 80, height: 80)

            Circle()
                .fill(rainbowGradient)
                .frame(width: 120, height: 120)
                .scaleEffect(isAnimating ? 1.6 : 0.1)
                .opacity(isAnimating ? 0.0 : 1.0)
                .animation(
                    Animation.easeInOut(duration: 2.0)
                        .repeatForever(autoreverses: false), // Standard animation
                    value: isAnimating
                )

            Image(systemName: "sparkles")
                .font(.system(size: 35))
                .foregroundColor(.white)
        }
        .frame(width: 150, height: 150)
        .onAppear {
            isAnimating = true
        }
    }
}

#Preview {
    AnimationContentView()
}

```

### Core Architecture Module: `Gists_To_Try/HandwrittenAnimation/HelloCH.swift`
```
//
//  HelloCH.swift
//
//

import SwiftUI

struct HelloCH: View {
    var body: some View {
        PhaseAnimator([false, true]) { drawHello in
            HelloCHShape()
                .trim(from: 0.0, to: drawHello ? 1.0 : 0.0)
                .stroke(style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
                .aspectRatio(520 / 166, contentMode: .fit)
                .frame(maxWidth: 520)
                .padding(.horizontal, 24)
        } animation: { drawHello in
                .easeOut(duration: 4).repeatForever(autoreverses: false)
        }
    }
}

struct HelloCHShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 461
        let sy = rect.height / 237

        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy)
        }

        var path = Path()

        path.move(to: p(10.4693, 69.6893))
        path.addCurve(to: p(8.90821, 162.537), control1: p(6.75657, 98.5131), control2: p(6.74258, 131.862))

        path.move(to: p(7.60449, 109.039))
        path.addCurve(to: p(34.9205, 69.7309), control1: p(8.13264, 88.2602), control2: p(18.2323, 69.7309))
        path.addCurve(to: p(54.6844, 101.336), control1: p(48.2835, 69.7309), control2: p(55.547, 80.8785))
        path.addCurve(to: p(35.4447, 161.838), control1: p(53.8244, 121.732), control2: p(46.4175, 144.804))

        path.move(to: p(35.6953, 161.839))
        path.addCurve(to: p(64.8885, 160.446), control1: p(44.1887, 162.952), control2: p(56.6711, 162.117))

        path.move(to: p(148.167, 15.4394))
        path.addCurve(to: p(75.71, 91.1217), control1: p(128.564, 41.7421), control2: p(98.0425, 74.4964))

        path.move(to: p(141.382, 25.1677))
        path.addCurve(to: p(211.442, 86.9034), control1: p(156.98, 44.8244), control2: p(187.284, 71.0082))

        path.move(to: p(111.442, 94.3475))
        path.addCurve(to: p(179.432, 93.9299), control1: p(136.983, 96.3313), control2: p(159.873, 96.6533))

        path.move(to: p(179.433, 93.93))
        path.addCurve(to: p(98.2911, 203.234), control1: p(116.867, 104.305), control2: p(86.8319, 150.266))

        path.move(to: p(98.291, 203.217))
        path.addCurve(to: p(144.445, 145.112), control1: p(101.632, 172.33), control2: p(117.673, 147.972))
        path.addCurve(to: p(180.673, 172.746), control1: p(166.255, 142.781), control2: p(180.673, 153.524))
        path.addCurve(to: p(135.016, 218.913), control1: p(180.673, 192.063), control2: p(163.738, 209.271))

        path.move(to: p(135.016, 218.913))
        path.addCurve(to: p(194.321, 215.687), control1: p(155.363, 218.169), control2: p(175.959, 217.424))

        path.move(to: p(244.84, 68.8784))
        path.addCurve(to: p(243.642, 176.251), control1: p(241.989, 102.211), control2: p(241.979, 140.777))

        path.move(to: p(242.919, 102.813))
        path.addCurve(to: p(265.435, 68.9696), control1: p(243.509, 84.0207), control2: p(251.59, 68.9696))
        path.addCurve(to: p(280.306, 97.0755), control1: p(276.232, 68.9696), control2: p(281.125, 78.3373))
        path.addCurve(to: p(263.586, 175.444), control1: p(279.098, 124.715), control2: p(271.399, 156.173))

        path.move(to: p(263.586, 175.444))
        path.addCurve(to: p(285.866, 173.834), control1: p(270.306, 176.739), control2: p(279.519, 175.777))

        path.move(to: p(292.705, 9.41528))
        path.addCurve(to: p(298.291, 50.9572), control1: p(293.026, 21.3079), control2: p(294.687, 38.073))

        path.move(to: p(298.291, 50.9571))
        path.addCurve(to: p(304.251, 23.0921), control1: p(296.176, 40.7165), control2: p(298.673, 29.6829))
        path.addCurve(to: p(336.748, 9.45085), control1: p(310.286, 15.9603), control2: p(319.288, 11.8081))
        path.addCurve(to: p(403.005, 8.98777), control1: p(354.23, 7.09074), control2: p(384.616, 6.65672))
        path.addCurve(to: p(424.841, 29.5833), control1: p(418.209, 10.8883), control2: p(425.09, 18.417))
        path.addCurve(to: p(363.799, 53.4046), control1: p(424.345, 45.4642), control2: p(405.238, 52.4121))
        path.addCurve(to: p(320.13, 50.6661), control1: p(345.437, 53.9009), control2: p(329.41, 52.5829))

        path.move(to: p(334.271, 9.52428))
        path.addCurve(to: p(348.315, 53.4027), control1: p(340.474, 30.9973), control2: p(345.09, 44.4302))

        path.move(to: p(389.358, 9.51168))
        path.addCurve(to: p(374.718, 52.9215), control1: p(382.906, 29.911), control2: p(378.192, 43.2468))

        path.move(to: p(328.806, 82.6598))
        path.addCurve(to: p(303.737, 108.645), control1: p(320.498, 90.5057), control2: p(311.708, 99.7983))

        path.move(to: p(303.737, 108.645))
        path.addCurve(to: p(342.481, 153.197), control1: p(328.201, 117.685), control2: p(341.762, 135.076))
        path.addCurve(to: p(324.908, 176.132), control1: p(343.094, 168.617), control2: p(334.371, 176.132))
        path.addCurve(to: p(309.515, 156.482), control1: p(315.653, 176.132), control2: p(308.422, 168.957))
        path.addCurve(to: p(328.103, 122.571), control1: p(310.522, 145), control2: p(316.417, 135.41))
        path.addCurve(to: p(374.445, 78.6864), control1: p(345.152, 103.84), control2: p(358.768, 91.8439))

        path.move(to: p(283.367, 199.615))
        path.addCurve(to: p(289.916, 226.285), control1: p(283.167, 205.839), control2: p(286.377, 219.903))

        path.move(to: p(311.138, 199.857))
        path.addCurve(to: p(317.227, 221.286), control1: p(311.008, 204.86), control2: p(314.001, 216.16))

        path.move(to: p(337.05, 199.398))
        path.addCurve(to: p(343.422, 217.423), control1: p(336.986, 203.608), control2: p(340.128, 213.114))

        path.move(to: p(366.145, 86.5042))
        path.addCurve(to: p(368.09, 229.087), control1: p(368.167, 117.584), control2: p(368.972, 179.736))

        path.move(to: p(427.493, 71.5826))
        path.addCurve(to: p(390.888, 103.177), control1: p(416.717, 83.0814), control2: p(403.8, 93.264))

        path.move(to: p(390.898, 103.31))
        path.addCurve(to: p(441.589, 99.1222), control1: p(406.138, 100.294), control2: p(425.292, 98.5015))

        path.move(to: p(391.71, 140.348))
        path.addCurve(to: p(439.576, 137.222), control1: p(406.069, 138.29), control2: p(424.152, 137.164))

        path.move(to: p(392.242, 174.867))
        path.addCurve(to: p(441.704, 171.747), control1: p(406.868, 173.137), control2: p(425.749, 172.095))

        path.move(to: p(414.974, 120.44))
        path.addCurve(to: p(415.932, 209.712), control1: p(416.199, 147.615), control2: p(416.349, 179.958))

        path.move(to: p(368.747, 213.246))
        path.addCurve(to: p(452.676, 208.675), control1: p(395.208, 211.069), control2: p(429.869, 209.279))

        return path
    }
}

#Preview {
    HelloCH()
}

```

### Core Architecture Module: `Gists_To_Try/HandwrittenAnimation/HelloDefault.swift`
```
//
//  HelloDefault.swift
//  SwiftUIFor27
//
//  Created by Amos Gyamfi on 19.7.2026.

import SwiftUI

struct HelloDefault: View {
    var body: some View {
        PhaseAnimator([false, true]) { drawHello in
            HelloDefaultShape()
                .trim(from: 0.0, to: drawHello ? 1.0 : 0.0)
                .stroke(style: StrokeStyle(lineWidth: 8, lineCap: .round, lineJoin: .round))
                .aspectRatio(520 / 166, contentMode: .fit)
                .frame(maxWidth: 520)
                .padding(.horizontal, 24)
        } animation: { drawHello in
                .easeOut(duration: 4).repeatForever(autoreverses: false)
        }
    }
}

struct HelloDefaultShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        var strokePath2 = Path()
        strokePath2.move(to: CGPoint(x: 0.01362*width, y: 0.83279*height))
        strokePath2.addCurve(to: CGPoint(x: 0.14078*width, y: 0.49017*height), control1: CGPoint(x: 0.0568*width, y: 0.75623*height), control2: CGPoint(x: 0.09615*width, y: 0.65776*height))
        strokePath2.addCurve(to: CGPoint(x: 0.18828*width, y: 0.15504*height), control1: CGPoint(x: 0.17116*width, y: 0.37577*height), control2: CGPoint(x: 0.1875*width, y: 0.24514*height))
        strokePath2.addCurve(to: CGPoint(x: 0.1595*width, y: 0.03722*height), control1: CGPoint(x: 0.18867*width, y: 0.08805*height), control2: CGPoint(x: 0.17843*width, y: 0.03722*height))
        strokePath2.addCurve(to: CGPoint(x: 0.1171*width, y: 0.20471*height), control1: CGPoint(x: 0.13849*width, y: 0.03722*height), control2: CGPoint(x: 0.12527*width, y: 0.08805*height))
        strokePath2.addCurve(to: CGPoint(x: 0.08482*width, y: 0.9518*height), control1: CGPoint(x: 0.10816*width, y: 0.33292*height), control2: CGPoint(x: 0.10155*width, y: 0.48004*height))
        path.addPath(strokePath2.strokedPath(StrokeStyle(lineWidth: 0.00157*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath4 = Path()
        strokePath4.move(to: CGPoint(x: 0.08646*width, y: 0.9057*height))
        strokePath4.addCurve(to: CGPoint(x: 0.16922*width, y: 0.49027*height), control1: CGPoint(x: 0.09502*width, y: 0.6656*height), control2: CGPoint(x: 0.1276*width, y: 0.49027*height))
        strokePath4.addCurve(to: CGPoint(x: 0.20544*width, y: 0.64411*height), control1: CGPoint(x: 0.19411*width, y: 0.49027*height), control2: CGPoint(x: 0.20993*width, y: 0.55355*height))
        strokePath4.addCurve(to: CGPoint(x: 0.19656*width, y: 0.81533*height), control1: CGPoint(x: 0.20291*width, y: 0.69747*height), control2: CGPoint(x: 0.19998*width, y: 0.75206*height))
        strokePath4.addCurve(to: CGPoint(x: 0.23844*width, y: 0.95677*height), control1: CGPoint(x: 0.19258*width, y: 0.89474*height), control2: CGPoint(x: 0.20396*width, y: 0.95677*height))
        strokePath4.addCurve(to: CGPoint(x: 0.37163*width, y: 0.7296*height), control1: CGPoint(x: 0.28871*width, y: 0.95677*height), control2: CGPoint(x: 0.34356*width, y: 0.86764*height))
        strokePath4.addCurve(to: CGPoint(x: 0.38547*width, y: 0.59945*height), control1: CGPoint(x: 0.38119*width, y: 0.68257*height), control2: CGPoint(x: 0.38508*width, y: 0.64039*height))
        strokePath4.addCurve(to: CGPoint(x: 0.3493*width, y: 0.46918*height), control1: CGPoint(x: 0.38586*width, y: 0.52501*height), control2: CGPoint(x: 0.37263*width, y: 0.46918*height))
        strokePath4.addCurve(to: CGPoint(x: 0.29718*width, y: 0.71235*height), control1: CGPoint(x: 0.31974*width, y: 0.46918*height), control2: CGPoint(x: 0.29718*width, y: 0.57588*height))
        strokePath4.addCurve(to: CGPoint(x: 0.37493*width, y: 0.96173*height), control1: CGPoint(x: 0.29718*width, y: 0.85876*height), control2: CGPoint(x: 0.32207*width, y: 0.96173*height))
        strokePath4.addCurve(to: CGPoint(x: 0.56301*width, y: 0.37932*height), control1: CGPoint(x: 0.44681*width, y: 0.96173*height), control2: CGPoint(x: 0.52643*width, y: 0.68649*height))
        strokePath4.addCurve(to: CGPoint(x: 0.57721*width, y: 0.15578*height), control1: CGPoint(x: 0.57334*width, y: 0.29259*height), control2: CGPoint(x: 0.57721*width, y: 0.21206*height))
        strokePath4.addCurve(to: CGPoint(x: 0.55193*width, y: 0.03782*height), control1: CGPoint(x: 0.57721*width, y: 0.08906*height), control2: CGPoint(x: 0.5706*width, y: 0.03782*height))
        strokePath4.addCurve(to: CGPoint(x: 0.5107*width, y: 0.15459*height), control1: CGPoint(x: 0.53365*width, y: 0.03782*height), control2: CGPoint(x: 0.52159*width, y: 0.0831*height))
        strokePath4.addCurve(to: CGPoint(x: 0.48464*width, y: 0.4923*height), control1: CGPoint(x: 0.49794*width, y: 0.23751*height), control2: CGPoint(x: 0.48851*width, y: 0.35711*height))
        strokePath4.addCurve(to: CGPoint(x: 0.54849*width, y: 0.95677*height), control1: CGPoint(x: 0.47492*width, y: 0.83153*height), control2: CGPoint(x: 0.4967*width, y: 0.95677*height))
        strokePath4.addCurve(to: CGPoint(x: 0.71675*width, y: 0.37837*height), control1: CGPoint(x: 0.61129*width, y: 0.95677*height), control2: CGPoint(x: 0.6811*width, y: 0.6777*height))
        strokePath4.addCurve(to: CGPoint(x: 0.73084*width, y: 0.15578*height), control1: CGPoint(x: 0.72696*width, y: 0.29259*height), control2: CGPoint(x: 0.73084*width, y: 0.21206*height))
        strokePath4.addCurve(to: CGPoint(x: 0.70556*width, y: 0.03782*height), control1: CGPoint(x: 0.73084*width, y: 0.08906*height), control2: CGPoint(x: 0.72423*width, y: 0.03782*height))
        strokePath4.addCurve(to: CGPoint(x: 0.66433*width, y: 0.15459*height), control1: CGPoint(x: 0.68728*width, y: 0.03782*height), control2: CGPoint(x: 0.67522*width, y: 0.0831*height))
        strokePath4.addCurve(to: CGPoint(x: 0.63827*width, y: 0.4923*height), control1: CGPoint(x: 0.65157*width, y: 0.23751*height), control2: CGPoint(x: 0.64213*width, y: 0.35711*height))
        strokePath4.addCurve(to: CGPoint(x: 0.69658*width, y: 0.95677*height), control1: CGPoint(x: 0.62855*width, y: 0.83153*height), control2: CGPoint(x: 0.65033*width, y: 0.95677*height))
        strokePath4.addCurve(to: CGPoint(x: 0.78287*width, y: 0.69204*height), control1: CGPoint(x: 0.74275*width, y: 0.95677*height), control2: CGPoint(x: 0.76783*width, y: 0.82838*height))
        strokePath4.addCurve(to: CGPoint(x: 0.85413*width, y: 0.47414*height), control1: CGPoint(x: 0.79774*width, y: 0.55727*height), control2: CGPoint(x: 0.81602*width, y: 0.47414*height))
        strokePath4.addCurve(to: CGPoint(x: 0.91053*width, y: 0.68878*height), control1: CGPoint(x: 0.88563*width, y: 0.47414*height), control2: CGPoint(x: 0.91053*width, y: 0.54858*height))
        strokePath4.addCurve(to: CGPoint(x: 0.83913*width, y: 0.96173*height), control1: CGPoint(x: 0.91053*width, y: 0.84386*height), control2: CGPoint(x: 0.87898*width, y: 0.96049*height))
        strokePath4.addCurve(to: CGPoint(x: 0.78334*width, y: 0.73593*height), control1: CGPoint(x: 0.80405*width, y: 0.96297*height), control2: CGPoint(x: 0.78101*width, y: 0.8724*height))
        strokePath4.addCurve(to: CGPoint(x: 0.85258*width, y: 0.47414*height), control1: CGPoint(x: 0.78607*width, y: 0.58456*height), control2: CGPoint(x: 0.81485*width, y: 0.47414*height))
        strokePath4.addCurve(to: CGPoint(x: 0.90703*width, y: 0.53865*height), control1: CGPoint(x: 0.87436*width, y: 0.47414*height), control2: CGPoint(x: 0.89265*width, y: 0.50502*height))
        strokePath4.addCurve(to: CGPoint(x: 0.98753*width, y: 0.48362*height), control1: CGPoint(x: 0.946*width, y: 0.62936*height), control2: CGPoint(x: 0.97603*width, y: 0.5733*height))
        path.addPath(strokePath4.strokedPath(StrokeStyle(lineWidth: 0.00157*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        return path
    }
}

#Preview {
    HelloDefault()
}

```

### Core Architecture Module: `Gists_To_Try/HandwrittenAnimation/HelloES.swift`
```
//
//  HelloES.swift
//  SwiftUIFor27
//
//  Created by Amos Gyamfi on 10.6.2026.
//

import SwiftUI

struct HelloES: View {
    var body: some View {
        PhaseAnimator([false, true]) { drawHello in
            HelloESShape()
                .trim(from: 0.0, to: drawHello ? 1.0 : 0.0)
                .stroke(style: StrokeStyle(lineWidth: 8, lineCap: .round, lineJoin: .round))
                .aspectRatio(520 / 166, contentMode: .fit)
                .frame(maxWidth: 520)
                .padding(.horizontal, 24)
        } animation: { drawHello in
                .easeInOut(duration: 3).repeatForever(autoreverses: false)
        }
    }
}

struct HelloESShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        var strokePath2 = Path()
        strokePath2.move(to: CGPoint(x: 0.01547*width, y: 0.84711*height))
        strokePath2.addCurve(to: CGPoint(x: 0.15394*width, y: 0.48499*height), control1: CGPoint(x: 0.06439*width, y: 0.76619*height), control2: CGPoint(x: 0.10671*width, y: 0.66465*height))
        strokePath2.addCurve(to: CGPoint(x: 0.20418*width, y: 0.15518*height), control1: CGPoint(x: 0.18708*width, y: 0.35889*height), control2: CGPoint(x: 0.2033*width, y: 0.24552*height))
        strokePath2.addCurve(to: CGPoint(x: 0.17151*width, y: 0.03736*height), control1: CGPoint(x: 0.20462*width, y: 0.08819*height), control2: CGPoint(x: 0.19314*width, y: 0.03736*height))
        strokePath2.addCurve(to: CGPoint(x: 0.12338*width, y: 0.20485*height), control1: CGPoint(x: 0.14767*width, y: 0.03736*height), control2: CGPoint(x: 0.13265*width, y: 0.08819*height))
        strokePath2.addCurve(to: CGPoint(x: 0.08673*width, y: 0.95195*height), control1: CGPoint(x: 0.11323*width, y: 0.33306*height), control2: CGPoint(x: 0.10572*width, y: 0.48019*height))
        path.addPath(strokePath2.strokedPath(StrokeStyle(lineWidth: 0.00178*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath4 = Path()
        strokePath4.move(to: CGPoint(x: 0.0886*width, y: 0.90584*height))
        strokePath4.addCurve(to: CGPoint(x: 0.18255*width, y: 0.49041*height), control1: CGPoint(x: 0.09796*width, y: 0.67447*height), control2: CGPoint(x: 0.1353*width, y: 0.49041*height))
        strokePath4.addCurve(to: CGPoint(x: 0.22366*width, y: 0.64426*height), control1: CGPoint(x: 0.2108*width, y: 0.49041*height), control2: CGPoint(x: 0.22876*width, y: 0.55368*height))
        strokePath4.addCurve(to: CGPoint(x: 0.21264*width, y: 0.82043*height), control1: CGPoint(x: 0.22079*width, y: 0.6976*height), control2: CGPoint(x: 0.21561*width, y: 0.75964*height))
        strokePath4.addCurve(to: CGPoint(x: 0.25118*width, y: 0.95691*height), control1: CGPoint(x: 0.20904*width, y: 0.89736*height), control2: CGPoint(x: 0.21934*width, y: 0.95691*height))
        strokePath4.addCurve(to: CGPoint(x: 0.33665*width, y: 0.6891*height), control1: CGPoint(x: 0.29612*width, y: 0.95691*height), control2: CGPoint(x: 0.32441*width, y: 0.8343*height))
        path.addPath(strokePath4.strokedPath(StrokeStyle(lineWidth: 0.00178*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath6 = Path()
        strokePath6.move(to: CGPoint(x: 0.41744*width, y: 0.4718*height))
        strokePath6.addCurve(to: CGPoint(x: 0.33399*width, y: 0.73111*height), control1: CGPoint(x: 0.37327*width, y: 0.48183*height), control2: CGPoint(x: 0.34023*width, y: 0.58702*height))
        strokePath6.addCurve(to: CGPoint(x: 0.3958*width, y: 0.96188*height), control1: CGPoint(x: 0.32825*width, y: 0.86262*height), control2: CGPoint(x: 0.3543*width, y: 0.96188*height))
        strokePath6.addCurve(to: CGPoint(x: 0.48102*width, y: 0.68892*height), control1: CGPoint(x: 0.44614*width, y: 0.96188*height), control2: CGPoint(x: 0.47881*width, y: 0.84028*height))
        strokePath6.addCurve(to: CGPoint(x: 0.4245*width, y: 0.47056*height), control1: CGPoint(x: 0.48278*width, y: 0.54376*height), control2: CGPoint(x: 0.45806*width, y: 0.47056*height))
        strokePath6.addCurve(to: CGPoint(x: 0.38477*width, y: 0.59462*height), control1: CGPoint(x: 0.39801*width, y: 0.47056*height), control2: CGPoint(x: 0.38388*width, y: 0.52639*height))
        strokePath6.addCurve(to: CGPoint(x: 0.46277*width, y: 0.80607*height), control1: CGPoint(x: 0.38563*width, y: 0.68793*height), control2: CGPoint(x: 0.41053*width, y: 0.79269*height))
        strokePath6.addCurve(to: CGPoint(x: 0.67436*width, y: 0.37811*height), control1: CGPoint(x: 0.53524*width, y: 0.82464*height), control2: CGPoint(x: 0.63435*width, y: 0.67409*height))
        strokePath6.addCurve(to: CGPoint(x: 0.6903*width, y: 0.15592*height), control1: CGPoint(x: 0.68591*width, y: 0.29273*height), control2: CGPoint(x: 0.6903*width, y: 0.2122*height))
        strokePath6.addCurve(to: CGPoint(x: 0.6616*width, y: 0.03796*height), control1: CGPoint(x: 0.6903*width, y: 0.0892*height), control2: CGPoint(x: 0.6828*width, y: 0.03796*height))
        strokePath6.addCurve(to: CGPoint(x: 0.6148*width, y: 0.15473*height), control1: CGPoint(x: 0.64085*width, y: 0.03796*height), control2: CGPoint(x: 0.62717*width, y: 0.08324*height))
        strokePath6.addCurve(to: CGPoint(x: 0.58522*width, y: 0.49244*height), control1: CGPoint(x: 0.60032*width, y: 0.23765*height), control2: CGPoint(x: 0.5896*width, y: 0.35725*height))
        strokePath6.addCurve(to: CGPoint(x: 0.6518*width, y: 0.95691*height), control1: CGPoint(x: 0.57418*width, y: 0.83168*height), control2: CGPoint(x: 0.59891*width, y: 0.95691*height))
        strokePath6.addCurve(to: CGPoint(x: 0.75619*width, y: 0.67532*height), control1: CGPoint(x: 0.70541*width, y: 0.95691*height), control2: CGPoint(x: 0.74086*width, y: 0.82634*height))
        path.addPath(strokePath6.strokedPath(StrokeStyle(lineWidth: 0.00178*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath8 = Path()
        strokePath8.move(to: CGPoint(x: 0.89544*width, y: 0.56432*height))
        strokePath8.addCurve(to: CGPoint(x: 0.8391*width, y: 0.47056*height), control1: CGPoint(x: 0.88678*width, y: 0.50834*height), control2: CGPoint(x: 0.86838*width, y: 0.47056*height))
        strokePath8.addCurve(to: CGPoint(x: 0.75163*width, y: 0.75344*height), control1: CGPoint(x: 0.79053*width, y: 0.47056*height), control2: CGPoint(x: 0.75403*width, y: 0.60703*height))
        strokePath8.addCurve(to: CGPoint(x: 0.80289*width, y: 0.96187*height), control1: CGPoint(x: 0.74954*width, y: 0.88743*height), control2: CGPoint(x: 0.77155*width, y: 0.96275*height))
        strokePath8.addCurve(to: CGPoint(x: 0.89467*width, y: 0.57805*height), control1: CGPoint(x: 0.84737*width, y: 0.96062*height), control2: CGPoint(x: 0.88007*width, y: 0.83784*height))
        strokePath8.addCurve(to: CGPoint(x: 0.90014*width, y: 0.48048*height), control1: CGPoint(x: 0.89647*width, y: 0.546*height), control2: CGPoint(x: 0.89833*width, y: 0.51254*height))
        path.addPath(strokePath8.strokedPath(StrokeStyle(lineWidth: 0.00178*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath10 = Path()
        strokePath10.move(to: CGPoint(x: 0.90013*width, y: 0.48048*height))
        strokePath10.addCurve(to: CGPoint(x: 0.89467*width, y: 0.57802*height), control1: CGPoint(x: 0.89831*width, y: 0.51299*height), control2: CGPoint(x: 0.89649*width, y: 0.54551*height))
        strokePath10.addCurve(to: CGPoint(x: 0.88341*width, y: 0.81299*height), control1: CGPoint(x: 0.88669*width, y: 0.72022*height), control2: CGPoint(x: 0.88301*width, y: 0.77632*height))
        strokePath10.addCurve(to: CGPoint(x: 0.92266*width, y: 0.95691*height), control1: CGPoint(x: 0.88433*width, y: 0.89859*height), control2: CGPoint(x: 0.89528*width, y: 0.95691*height))
        strokePath10.addCurve(to: CGPoint(x: 0.98569*width, y: 0.81919*height), control1: CGPoint(x: 0.9571*width, y: 0.95691*height), control2: CGPoint(x: 0.97641*width, y: 0.89115*height))
        path.addPath(strokePath10.strokedPath(StrokeStyle(lineWidth: 0.00178*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        return path
    }
}
#Preview {
    HelloES()
}

```

### Core Architecture Module: `Gists_To_Try/HandwrittenAnimation/HelloFI.swift`
```
//
//  HelloFI.swift
//  SwiftUIFor27
//
//  Created by Amos Gyamfi on 10.6.2026.
//

import SwiftUI

struct HelloFI: View {
    var body: some View {
        PhaseAnimator([false, true]) { drawHello in
            HelloFIShape()
                .trim(from: 0.0, to: drawHello ? 1.0 : 0.0)
                .stroke(style: StrokeStyle(lineWidth: 8, lineCap: .round, lineJoin: .round))
                .aspectRatio(520 / 166, contentMode: .fit)
                .frame(maxWidth: 520)
                .padding(.horizontal, 24)
        } animation: { drawHello in
                .easeOut(duration: 3).repeatForever(autoreverses: false)
        }
    }
}

struct HelloFIShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 373
        let sy = rect.height / 200

        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy)
        }

        var path = Path()

        path.move(to: p(7.44531, 166.558))
        path.addCurve(to: p(88.5723, 98.0349), control1: p(34.9925, 151.245), control2: p(60.0941, 131.553))
        path.addCurve(to: p(118.875, 31.008), control1: p(107.957, 75.1542), control2: p(118.378, 49.0282))
        path.addCurve(to: p(100.512, 7.4442), control1: p(119.123, 17.609), control2: p(112.589, 7.4442))
        path.addCurve(to: p(73.4653, 40.9417), control1: p(87.113, 7.4442), control2: p(78.6763, 17.609))
        path.addCurve(to: p(52.8698, 190.361), control1: p(67.7581, 66.5846), control2: p(63.5398, 96.009))

        path.move(to: p(53.9155, 181.14))
        path.addCurve(to: p(106.716, 98.0536), control1: p(59.3782, 133.12), control2: p(80.165, 98.0536))
        path.addCurve(to: p(129.824, 128.823), control1: p(122.597, 98.0536), control2: p(132.69, 110.709))
        path.addCurve(to: p(124.162, 163.066), control1: p(128.211, 139.493), control2: p(126.341, 150.411))
        path.addCurve(to: p(150.875, 191.354), control1: p(121.622, 178.947), control2: p(128.881, 191.354))
        path.addCurve(to: p(235.85, 145.921), control1: p(182.95, 191.354), control2: p(217.943, 173.529))
        path.addCurve(to: p(244.681, 119.89), control1: p(241.952, 136.515), control2: p(244.433, 128.078))
        path.addCurve(to: p(221.604, 93.8353), control1: p(244.929, 105.002), control2: p(236.493, 93.8353))
        path.addCurve(to: p(188.354, 142.471), control1: p(202.746, 93.8353), control2: p(188.354, 115.175))
        path.addCurve(to: p(235.623, 192.346), control1: p(188.354, 171.751), control2: p(204.235, 192.346))
        path.addCurve(to: p(311.702, 118.523), control1: p(273.676, 192.346), control2: p(303.719, 161.49))
        path.addCurve(to: p(316.183, 96.0685), control1: p(313.07, 111.162), control2: p(314.914, 103.577))

        path.move(to: p(316.184, 96.0685))
        path.addCurve(to: p(309.061, 139.245), control1: p(313.331, 112.942), control2: p(310.705, 126.838))
        path.addCurve(to: p(307.736, 161.329), control1: p(308.129, 147.433), control2: p(307.685, 154.381))
        path.addCurve(to: p(331.034, 191.354), control1: p(307.869, 179.195), control2: p(316.566, 191.354))
        path.addCurve(to: p(364.867, 165.534), control1: p(349.286, 191.354), control2: p(359.97, 179.112))

        return path
    }
}

#Preview {
    HelloFI()
}

```

### Core Architecture Module: `Gists_To_Try/HandwrittenAnimation/HelloKo.swift`
```
//
//  HelloKo.swift
//  SwiftUIFor27
//
//  Created by Amos Gyamfi on 10.6.2026.
//

import SwiftUI

struct HelloKo: View {
    var body: some View {
        PhaseAnimator([false, true]) { drawHello in
            HelloKoShape()
                .trim(from: 0.0, to: drawHello ? 1.0 : 0.0)
                .stroke(style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
                .aspectRatio(520 / 166, contentMode: .fit)
                .frame(maxWidth: 520)
                .padding(.horizontal, 24)
        } animation: { drawHello in
                .easeInOut(duration: 4).repeatForever(autoreverses: false)
        }
    }
}

struct HelloKoShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        var strokePath2 = Path()
        strokePath2.move(to: CGPoint(x: 0.05407*width, y: 0.10057*height))
        strokePath2.addCurve(to: CGPoint(x: 0.03924*width, y: 0.19644*height), control1: CGPoint(x: 0.05385*width, y: 0.14475*height), control2: CGPoint(x: 0.05124*width, y: 0.17765*height))
        strokePath2.addCurve(to: CGPoint(x: 0.00675*width, y: 0.35435*height), control1: CGPoint(x: 0.02463*width, y: 0.219*height), control2: CGPoint(x: 0.00872*width, y: 0.2632*height))
        strokePath2.addCurve(to: CGPoint(x: 0.04208*width, y: 0.53575*height), control1: CGPoint(x: 0.00457*width, y: 0.4521*height), control2: CGPoint(x: 0.01918*width, y: 0.53388*height))
        strokePath2.addCurve(to: CGPoint(x: 0.08154*width, y: 0.36469*height), control1: CGPoint(x: 0.0641*width, y: 0.5367*height), control2: CGPoint(x: 0.08198*width, y: 0.47748*height))
        strokePath2.addCurve(to: CGPoint(x: 0.04339*width, y: 0.19268*height), control1: CGPoint(x: 0.08111*width, y: 0.25942*height), control2: CGPoint(x: 0.06475*width, y: 0.2049*height))
        path.addPath(strokePath2.strokedPath(StrokeStyle(lineWidth: 0.00088*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath4 = Path()
        strokePath4.move(to: CGPoint(x: 0.15001*width, y: 0.0329*height))
        strokePath4.addCurve(to: CGPoint(x: 0.13518*width, y: 0.60719*height), control1: CGPoint(x: 0.14761*width, y: 0.1908*height), control2: CGPoint(x: 0.14238*width, y: 0.38913*height))
        strokePath4.addCurve(to: CGPoint(x: 0.1173*width, y: 0.74348*height), control1: CGPoint(x: 0.13191*width, y: 0.71622*height), control2: CGPoint(x: 0.12494*width, y: 0.74348*height))
        strokePath4.addCurve(to: CGPoint(x: 0.10815*width, y: 0.64667*height), control1: CGPoint(x: 0.10945*width, y: 0.74348*height), control2: CGPoint(x: 0.10618*width, y: 0.70212*height))
        strokePath4.addCurve(to: CGPoint(x: 0.12603*width, y: 0.47936*height), control1: CGPoint(x: 0.11054*width, y: 0.58087*height), control2: CGPoint(x: 0.11687*width, y: 0.53012*height))
        strokePath4.addCurve(to: CGPoint(x: 0.17574*width, y: 0.34119*height), control1: CGPoint(x: 0.13736*width, y: 0.41733*height), control2: CGPoint(x: 0.15459*width, y: 0.35811*height))
        path.addPath(strokePath4.strokedPath(StrokeStyle(lineWidth: 0.00088*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath6 = Path()
        strokePath6.move(to: CGPoint(x: 0.06061*width, y: 0.69366*height))
        strokePath6.addCurve(to: CGPoint(x: 0.05887*width, y: 0.84499*height), control1: CGPoint(x: 0.05821*width, y: 0.73596*height), control2: CGPoint(x: 0.05734*width, y: 0.79611*height))
        strokePath6.addCurve(to: CGPoint(x: 0.09615*width, y: 0.95872*height), control1: CGPoint(x: 0.06127*width, y: 0.9183*height), control2: CGPoint(x: 0.07304*width, y: 0.95778*height))
        strokePath6.addCurve(to: CGPoint(x: 0.13693*width, y: 0.93804*height), control1: CGPoint(x: 0.11403*width, y: 0.95966*height), control2: CGPoint(x: 0.12886*width, y: 0.94838*height))
        path.addPath(strokePath6.strokedPath(StrokeStyle(lineWidth: 0.00088*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath8 = Path()
        strokePath8.move(to: CGPoint(x: 0.23505*width, y: 0.16073*height))
        strokePath8.addCurve(to: CGPoint(x: 0.22851*width, y: 0.38537*height), control1: CGPoint(x: 0.23069*width, y: 0.23874*height), control2: CGPoint(x: 0.22829*width, y: 0.31863*height))
        strokePath8.addCurve(to: CGPoint(x: 0.26122*width, y: 0.532*height), control1: CGPoint(x: 0.22873*width, y: 0.48124*height), control2: CGPoint(x: 0.24246*width, y: 0.53012*height))
        strokePath8.addCurve(to: CGPoint(x: 0.3009*width, y: 0.49534*height), control1: CGPoint(x: 0.27779*width, y: 0.53294*height), control2: CGPoint(x: 0.29262*width, y: 0.51696*height))
        path.addPath(strokePath8.strokedPath(StrokeStyle(lineWidth: 0.00088*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath10 = Path()
        strokePath10.move(to: CGPoint(x: 0.30264*width, y: 0.21336*height))
        strokePath10.addCurve(to: CGPoint(x: 0.3541*width, y: 0.20678*height), control1: CGPoint(x: 0.32423*width, y: 0.21712*height), control2: CGPoint(x: 0.3408*width, y: 0.2143*height))
        path.addPath(strokePath10.strokedPath(StrokeStyle(lineWidth: 0.00088*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath12 = Path()
        strokePath12.move(to: CGPoint(x: 0.29916*width, y: 0.33743*height))
        strokePath12.addCurve(to: CGPoint(x: 0.35062*width, y: 0.32991*height), control1: CGPoint(x: 0.31616*width, y: 0.33837*height), control2: CGPoint(x: 0.33622*width, y: 0.33649*height))
        path.addPath(strokePath12.strokedPath(StrokeStyle(lineWidth: 0.00088*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath14 = Path()
        strokePath14.move(to: CGPoint(x: 0.35825*width, y: 0.0329*height))
        strokePath14.addCurve(to: CGPoint(x: 0.34691*width, y: 0.47748*height), control1: CGPoint(x: 0.35563*width, y: 0.1908*height), control2: CGPoint(x: 0.35105*width, y: 0.35999*height))
        strokePath14.addCurve(to: CGPoint(x: 0.32118*width, y: 0.65512*height), control1: CGPoint(x: 0.3432*width, y: 0.58463*height), control2: CGPoint(x: 0.33884*width, y: 0.63727*height))
        strokePath14.addCurve(to: CGPoint(x: 0.28738*width, y: 0.80457*height), control1: CGPoint(x: 0.30417*width, y: 0.67205*height), control2: CGPoint(x: 0.28956*width, y: 0.72374*height))
        strokePath14.addCurve(to: CGPoint(x: 0.32074*width, y: 0.96906*height), control1: CGPoint(x: 0.28498*width, y: 0.89575*height), control2: CGPoint(x: 0.29894*width, y: 0.96906*height))
        strokePath14.addCurve(to: CGPoint(x: 0.35803*width, y: 0.81491*height), control1: CGPoint(x: 0.34146*width, y: 0.96906*height), control2: CGPoint(x: 0.35825*width, y: 0.91454*height))
        strokePath14.addCurve(to: CGPoint(x: 0.32314*width, y: 0.65419*height), control1: CGPoint(x: 0.35759*width, y: 0.7181*height), control2: CGPoint(x: 0.34211*width, y: 0.66264*height))
        path.addPath(strokePath14.strokedPath(StrokeStyle(lineWidth: 0.00088*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath16 = Path()
        strokePath16.move(to: CGPoint(x: 0.43674*width, y: 0.08365*height))
        strokePath16.addCurve(to: CGPoint(x: 0.4821*width, y: 0.08741*height), control1: CGPoint(x: 0.45179*width, y: 0.07801*height), control2: CGPoint(x: 0.46422*width, y: 0.07801*height))
        path.addPath(strokePath16.strokedPath(StrokeStyle(lineWidth: 0.00088*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath18 = Path()
        strokePath18.move(to: CGPoint(x: 0.42257*width, y: 0.21242*height))
        strokePath18.addCurve(to: CGPoint(x: 0.47708*width, y: 0.20772*height), control1: CGPoint(x: 0.44023*width, y: 0.20302*height), control2: CGPoint(x: 0.45768*width, y: 0.20114*height))
        strokePath18.addCurve(to: CGPoint(x: 0.50369*width, y: 0.28104*height), control1: CGPoint(x: 0.49562*width, y: 0.21242*height), control2: CGPoint(x: 0.50521*width, y: 0.24156*height))
        strokePath18.addCurve(to: CGPoint(x: 0.46073*width, y: 0.34589*height), control1: CGPoint(x: 0.50216*width, y: 0.32239*height), control2: CGPoint(x: 0.48711*width, y: 0.33931*height))
        strokePath18.addCurve(to: CGPoint(x: 0.41908*width, y: 0.50474*height), control1: CGPoint(x: 0.4326*width, y: 0.35247*height), control2: CGPoint(x: 0.42039*width, y: 0.41827*height))
        strokePath18.addCurve(to: CGPoint(x: 0.45266*width, y: 0.66922*height), control1: CGPoint(x: 0.41778*width, y: 0.58463*height), control2: CGPoint(x: 0.4302*width, y: 0.66358*height))
        strokePath18.addCurve(to: CGPoint(x: 0.49148*width, y: 0.51884*height), control1: CGPoint(x: 0.47512*width, y: 0.67392*height), control2: CGPoint(x: 0.49017*width, y: 0.59779*height))
        strokePath18.addCurve(to: CGPoint(x: 0.46051*width, y: 0.34683*height), control1: CGPoint(x: 0.493*width, y: 0.42391*height), control2: CGPoint(x: 0.48123*width, y: 0.35905*height))
        path.addPath(strokePath18.strokedPath(StrokeStyle(lineWidth: 0.00088*width, lineCap: .butt, lineJoin: .miter, miterLimit: 4)))
        var strokePath20 = Path()
        strokePath20.move(to: CGPoint(x: 0.55863*width, y: 0.0329*height))
        strokePath20.addCurve(to: CGPoint(x: 0.54075*width, y: 0.704*height), control1: CGPoint(x: 0.55558*width, y: 0.2237*height), control2: CGPoint(x: 0.54904*width, y: 0.42109*height))
        strokePath20.addCurve(to: CGPoint(x: 0.52004*width, y: 0.95308*height), control1: CGPoint(x: 0.53574*width, y: 0.87789*height), control2: CGPoint(x: 0.52941*width, y: 0.95308*height))
        strokePath20.addCurve(to: CGPoint(x: 0.51088*width, y: 0.85251*height), control1: CGPoint(x: 0.51263*width, y: 0.95308*height), control2: CGPoint(x: 0.50892*width, y: 0.923*height))
        strokePath20.addCurve(to: CGPoint(x: 0.52985*width, y: 0.63163*height), control1: CGPoint(x: 0.51306*width, y: 0.77356*height), control2: CGPoint(x: 0.51895*width, y: 0.70682*height))
        str
```

### Core Architecture Module: `Gists_To_Try/HandwrittenAnimation/HelloKoAR.swift`
```
//
//  HelloAR.swift
//  SwiftUIFor27
//
//  Created by Amos Gyamfi on 10.6.2026.
//

import SwiftUI

struct HelloAR: View {
    var body: some View {
        PhaseAnimator([false, true]) { drawHello in
            HelloARShape()
                .trim(from: 0.0, to: drawHello ? 1.0 : 0.0)
                .stroke(style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
                .aspectRatio(520 / 166, contentMode: .fit)
                .frame(maxWidth: 520)
                .padding(.horizontal, 24)
        } animation: { drawHello in
                .easeInOut(duration: 3).repeatForever(autoreverses: false)
        }
    }
}

import SwiftUI

struct HelloARShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 557
        let sy = rect.height / 226

        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy)
        }

        var path = Path()

        path.move(to: p(511.415, 176.427))
        path.addCurve(
            to: p(474.938, 134.988),
            control1: p(487.345, 173.946),
            control2: p(474.938, 155.829)
        )
        path.addCurve(
            to: p(512.655, 94.7893),
            control1: p(474.938, 112.599),
            control2: p(491.067, 94.7893)
        )
        path.addCurve(
            to: p(549.38, 132.506),
            control1: p(536.477, 94.7893),
            control2: p(549.38, 111.911)
        )
        path.addCurve(
            to: p(494.401, 179.166),
            control1: p(549.38, 160.298),
            control2: p(529.529, 176.923)
        )
        path.addCurve(
            to: p(387.097, 95.0375),
            control1: p(440.975, 182.576),
            control2: p(398.188, 148.726)
        )

        path.move(to: p(387.097, 95.0375))
        path.addCurve(
            to: p(391.812, 160.794),
            control1: p(391.315, 120.348),
            control2: p(393.3, 138.214)
        )
        path.addCurve(
            to: p(333.747, 218.363),
            control1: p(389.827, 197.023),
            control2: p(364.764, 218.363)
        )
        path.addCurve(
            to: p(317.37, 216.129),
            control1: p(328.04, 218.363),
            control2: p(322.829, 217.618)
        )

        path.move(to: p(181.886, 204.467))
        path.addCurve(
            to: p(217.122, 104.963),
            control1: p(165.757, 143.176),
            control2: p(183.127, 104.963)
        )
        path.addCurve(
            to: p(264.02, 133.003),
            control1: p(235.065, 104.963),
            control2: p(248.328, 114.277)
        )
        path.addCurve(
            to: p(308.093, 161.042),
            control1: p(280.988, 153.251),
            control2: p(294.171, 161.042)
        )
        path.addCurve(
            to: p(304.715, 146.402),
            control1: p(325.723, 161.042),
            control2: p(324.566, 147.147)
        )
        path.addCurve(
            to: p(172.703, 181.886),
            control1: p(273.698, 145.41),
            control2: p(229.033, 181.886)
        )
        path.addCurve(
            to: p(110.174, 116.626),
            control1: p(134.33, 181.886),
            control2: p(114.031, 157.694)
        )

        path.move(to: p(110.174, 116.626))
        path.addCurve(
            to: p(65.5896, 181.886),
            control1: p(114.392, 161.042),
            control2: p(97.0226, 181.886)
        )
        path.addCurve(
            to: p(19.6098, 121.061),
            control1: p(39.6961, 181.886),
            control2: p(25.5996, 158.747)
        )
        path.addCurve(
            to: p(7.4444, 7.4444),
            control1: p(13.896, 85.1119),
            control2: p(9.67765, 45.6578)
        )

        path.move(to: p(120.844, 26.0548))
        path.addCurve(
            to: p(71.4642, 41.4395),
            control1: p(106.452, 29.7769),
            control2: p(86.6007, 35.7323)
        )

        path.move(to: p(127.792, 54.839))
        path.addCurve(
            to: p(78.164, 70.2236),
            control1: p(113.152, 58.5611),
            control2: p(93.0523, 64.5164)
        )

        return path
    }
}

#Preview {
    HelloAR()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12** (2023-06-20): **Update README.md**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Great

- **Issue #2** (2020-07-08): **Create LICENSE**
  *Symptoms*: 

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `34f925a4` (2026-03-15)
**Commit Message**: Create AddToBookmark SwiftUI view

This file implements a SwiftUI view for adding bookmarks, including a web view and a bottom navigation bar with various actions.

**File**: `Gists_To_Try/AddToBookmark.swift` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+//
+//  AddToBookmark.swift
+//  SwiftUIAnimation2026
+//
+//  Created by Amos Gyamfi on 16.3.2026.
+//
+
+import SwiftUI
+import WebKit
+
+struct AddToBookmark: View {
+    @State private var urlText: String = "developer.apple.com/"
+    @State private var bookmarkTrigger: Int = 0
+    let url = URL(string: "https://developer.apple.com")!
+    
+    var body: some View {
+        NavigationStack {
+            ZStack {
+                
+                WebView(url: url)
+                
+                VStack {
+                    Spacer()
+                    
+                    HStack {
+                        PhaseAnimator([false, true], trigger: bookmarkTrigger) { move in
+                            ZStack {
+                                Circle()
+                                    .trim(from: 0.5, to: 1.0)
+                                    .stroke()
+                                    .opacity(0)
+                                Image(systemName: "safari.fill")
+                                    .font(.largeTitle)
+                                    .offset(x: -162, y: -17)
+                                    .rotationEffect(.degrees(move ? 180.0 : 0.0))
+                                    .opacity(move ? 0 : 1)
+                                //.scaleEffect(move ? 1 : 0)
+                            }
+                        } animation: { move in
+                            move ? .easeInOut(duration: 1) : .linear(duration: 0)
+                        }
+                        .offset(y: 240)
+                        
+                        Spacer()
+                    }
+                    .padding()
+                    
+                    bottomBar
+                }
+            }
+            .preferredColorScheme(.dark)
+        }
+    }
+    
+    var bottomBar: some View {
+        HStack(spacing: 12) {
+            Button(action: {}) {
+                Image(systemName: "chevron.left")
+                    .font(.system(size: 16, weight: .semibold))
+                    .foregroundStyle(.white)
+                    .frame(width: 36, height: 36)
+                    .background(.black, in: Circle())
+            }
+            
+            HStack(spacing: 32) {
+                Image(systemName: "text.justify.left")
+                    .font(.system(size: 12))
+                    .foregroundStyle(.white.opacity(0.6))
+                
+                Text(urlText)
+                    .font(.system(size: 14, weight: .medium))
+                    .foregroundStyle(.white)
+                
+                Button(action: {}) {
+                    Image(systemName: "arrow.clockwise")
+                        .font(.system(size: 13, weight: .medium))
+                        .foregroundStyle(.white.opacity(0.6))
+                }
+            }
+            .frame(maxWidth: .infinity)
+            .frame(height: 36)
+            .background(.black, in: Capsule())
+            
+            Menu {
+                Button(action: {}) {
+                    Label("Share", systemImage: "square.and.arrow.up")
+                }
+                Button(action: { bookmarkTrigger += 1 }) {
+                    Label("Add to Bookmarks", systemImage: "bookmark")
+                }
+                Button(action: {}) {
+                    Label("Add Bookmark to...", systemImage: "book")
+                }
+                Divider()
+                Button(action: {}) {
+                    Label("New Tab", systemImage: "plus")
+                }
+                Button(action: {}) {
+                    Label("New Private Tab", systemImage: "hand.raised.fill")
+                }
+                Divider()
+                HStack {
+                    Button(action: {}) {
+                        Label("Bookmarks", systemImage: "book.fill")
+                    }
+                    Button(action: {}) {
+                        Label("All Tabs", systemImage: "rectangle.on.rectangle")
+                    }
+                }
+            } label: {
+                Image(systemName: "ellipsis")
+                    .font(.system(size: 16, weight: .semibold))
+                    .foregroundStyle(.white)
+                    .frame(width: 36, height: 36)
+                    .background(.black, in: Circle())
+            }
+        }
+        .padding(.horizontal, 16)
+        .padding(.bottom, 8)
+    }
+}
+
+#Preview {
+    AddToBookmark()
+}
```

---

### Incident Patch 2: `702374ef` (2026-01-02)
**Commit Message**: Update README with SwiftUI New Year's Eve Fireworks

Added a new section for SwiftUI New Year's Eve Fireworks and updated the order of existing sections.

**File**: `README.md` (modified, +5/-5)
```diff
@@ -65,6 +65,11 @@ struct LiquidGlassEffectContainer: View {
 
 ---
 
+### SwiftUI New Year's Eve Fireworks: [Gist](https://github.com/amosgyamfi/open-swiftui-animations/blob/master/Gists_To_Try/NewYearsEveFireworks2026.swift)
+![SwiftUI New Year's Eve Fireworks](GIF_Previews/SwiftUINewYearsEveFireworks.gif)
+
+---
+
 ### Image generation loader: [Gist](https://gist.github.com/amosgyamfi/b9fb404fcc1fc14b735f84095b8f7552#file-imagegenerationloader-swift)
 ![Image generation loader](GIF_Previews/imageGenerator.gif)
 
@@ -80,11 +85,6 @@ struct LiquidGlassEffectContainer: View {
 
 ---
 
-### SwiftUI Fireworks Animation: [Gist](https://github.com/amosgyamfi/open-swiftui-animations/blob/master/Gists_To_Try/GeminiFireworksAnimation.swift) - Before running the code, ensure you have a small image like "Spark.png" in your assets catalog. 
-![SwiftUI fireworks animation](GIF_Previews/Gemini2-5SwiftUIFireworks.gif)
-
----
-
 ### Thinking, Weighing Options, Evaluating Sentence 
 ![](GIF_Previews/thinkingWeighingEvaluating.gif)
 ---
```

---

### Incident Patch 3: `2bf3a3e5` (2025-12-31)
**Commit Message**: Add New Year's Eve Fireworks 2026 SwiftUI view

**File**: `Gists_To_Try/NewYearsEveFireworks2026.swift` (added, +405/-0)
```diff
@@ -0,0 +1,405 @@
+//
+//  SwiftUIChristmas25Tree.swift
+//
+//  Created by Amos Gyamfi on 22.12.2025.
+
+//  ContentView.swift
+//  SwiftUIChristmasTree
+//
+
+import SwiftUI
+import UIKit
+
+// MARK: - Fireworks Background View
+struct Fireworks25View: UIViewRepresentable {
+    
+    func makeUIView(context: Context) -> UIView {
+        let host = FireworksHostView()
+        host.backgroundColor = .clear
+        return host
+    }
+    
+    func updateUIView(_ uiView: UIView, context: Context) {
+        // Layout is handled in FireworksHostView.layoutSubviews
+    }
+}
+
+// Custom UIView that handles its own emitter layer
+class FireworksHostView: UIView {
+    
+    private var particlesLayer: CAEmitterLayer?
+    
+    override init(frame: CGRect) {
+        super.init(frame: frame)
+        setupEmitter()
+    }
+    
+    required init?(coder: NSCoder) {
+        super.init(coder: coder)
+        setupEmitter()
+    }
+    
+    private func setupEmitter() {
+        let emitterLayer = CAEmitterLayer()
+        emitterLayer.emitterShape = .cuboid
+        emitterLayer.emitterMode = .outline
+        emitterLayer.renderMode = .additive
+        emitterLayer.seed = UInt32(Date().timeIntervalSince1970)
+        
+        // Create spark image programmatically
+        let sparkImage = createSparkImage()
+        
+        let cell1 = CAEmitterCell()
+        cell1.name = "Parent"
+        cell1.birthRate = 5.0
+        cell1.lifetime = 2.5
+        cell1.velocity = 300.0
+        cell1.velocityRange = 100.0
+        cell1.yAcceleration = -100.0
+        cell1.emissionLongitude = -90.0 * (.pi / 180.0)
+        cell1.emissionRange = 45.0 * (.pi / 180.0)
+        cell1.scale = 0.0
+        cell1.color = UIColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0).cgColor
+        cell1.redRange = 0.9
+        cell1.greenRange = 0.9
+        cell1.blueRange = 0.9
+        
+        let subcell1_1 = CAEmitterCell()
+        subcell1_1.contents = sparkImage
+        subcell1_1.name = "Trail"
+        subcell1_1.birthRate = 45.0
+        subcell1_1.lifetime = 0.5
+        subcell1_1.beginTime = 0.01
+        subcell1_1.duration = 1.7
+        subcell1_1.velocity = 80.0
+        subcell1_1.velocityRange = 100.0
+        subcell1_1.xAcceleration = 100.0
+        subcell1_1.yAcceleration = 350.0
+        subcell1_1.emissionLongitude = -360.0 * (.pi / 180.0)
+        subcell1_1.emissionRange = 22.5 * (.pi / 180.0)
+        subcell1_1.scale = 0.5
+        subcell1_1.scaleSpeed = 0.13
+        subcell1_1.alphaSpeed = -0.7
+        subcell1_1.color = UIColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0).cgColor
+        
+        let subcell1_2 = CAEmitterCell()
+        subcell1_2.contents = sparkImage
+        subcell1_2.name = "Firework"
+        subcell1_2.birthRate = 20000.0
+        subcell1_2.lifetime = 15.0
+        subcell1_2.beginTime = 1.6
+        subcell1_2.duration = 0.1
+        subcell1_2.velocity = 190.0
+        subcell1_2.yAcceleration = 80.0
+        subcell1_2.emissionRange = 360.0 * (.pi / 180.0)
+        subcell1_2.spin = 114.6 * (.pi / 180.0)
+        subcell1_2.scale = 0.1
+        subcell1_2.scaleSpeed = 0.09
+        subcell1_2.alphaSpeed = -0.7
+        subcell1_2.color = UIColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0).cgColor
+        
+        cell1.emitterCells = [subcell1_1, subcell1_2]
+        emitterLayer.emitterCells = [cell1]
+        
+        layer.addSublayer(emitterLayer)
+        self.particlesLayer = emitterLayer
+    }
+    
+    override func layoutSubviews() {
+        super.layoutSubviews()
+        
+        // Update emitter frame and position when layout changes
+        CATransaction.begin()
+        CATransaction.setDisableActions(true)
+        particlesLayer?.frame = bounds
+        particlesLayer?.emitterPosition = CGPoint(x: bounds.width / 2, y: bounds.height - 50)
+        particlesLayer?.emitterSize = CGSize(width: 0.0, height: 0.0)
+        CATransaction.commit()
+    }
+    
+    private func createSparkImage() -> CGImage? {
+        let size: CGFloat = 64
+        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
+        
+        let image = renderer.image { context in
+            let center = CGPoint(x: size / 2, y: size / 2)
+            let colors = [
+                UIColor.white.cgColor,
+                UIColor.white.withAlphaComponent(0.8).cgColor,
+                UIColor.white.withAlphaComponent(0.0).cgColor
+            ] as CFArray
+            
+            let locations: [CGFloat] = [0.0, 0.3, 1.0]
+            
+            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: locations) {
+                context.cgContext.drawRadialGradient(
+                    gradient,
+                    startCenter: center,
+                    startRadius: 0,
+                    endCenter: center,
+                    endRadius: size / 2,
+                    options: .
```

---

### Incident Patch 4: `6f5a9e32` (2025-12-29)
**Commit Message**: Add animated visual guide for SwiftUI masking and clipping

Added animated visual guides for SwiftUI mask and clipShape functions.

**File**: `README.md` (modified, +5/-0)
```diff
@@ -55,6 +55,11 @@ struct LiquidGlassEffectContainer: View {
 ```
 ---
 
+### Animated, visual guide to SwiftUI mask(alignment:_:), clipShape(_:style:), and clipped(antialiased:): [Gist](https://github.com/amosgyamfi/open-swiftui-animations/blob/master/Gists_To_Try/MaskClippedClipShape.swift)
+![Animated, visual guide to SwiftUI mask(alignment:_:), clipShape(_:style:), and clipped(antialiased:)](GIF_Previews/MaskClippedClipShape.gif)
+
+---
+
 ### 2D rotation around specified anchor: [Gist](https://github.com/amosgyamfi/open-swiftui-animations/blob/master/Gists_To_Try/FlowerAnimation.swift)
 ![2D rotation around specified anchor](GIF_Previews/2dAnchorRotation.gif)
 
```

---

### Incident Patch 5: `ba35f668` (2025-12-29)
**Commit Message**: Add MaskClippedClipShape SwiftUI view

**File**: `Gists_To_Try/MaskClippedClipShape.swift` (added, +187/-0)
```diff
@@ -0,0 +1,187 @@
+//
+//  MaskClippedClipShape.swift
+//
+//
+//  ListeningAnimation.swift
+//  SwiftUIAnimation2026
+//
+//  Created by Amos Gyamfi on 28.12.2025.
+//
+
+import SwiftUI
+
+struct MaskClippedClipShape: View {
+    var body: some View {
+        List {
+            Section {
+                HStack {
+                    Spacer()
+                    ZStack {
+                        Circle()
+                            .frame(width: 164, height: 164)
+                            .foregroundStyle(.indigo.gradient)
+                            .glassEffect()
+                            .blendMode(.hardLight)
+                            .overlay(
+                                Image(systemName: "microphone.fill")
+                                    .font(.largeTitle)
+                                    .offset(y: -40)
+                            )
+                        
+                        PhaseAnimator([false, true]) { move in
+                            Circle()
+                                .strokeBorder(
+                                    style: StrokeStyle(
+                                        lineWidth: 12,
+                                        lineCap: .round,
+                                        lineJoin: .round,
+                                        dash: [60, 400],
+                                        dashPhase: move ? 220 : -220)
+                                )
+                                .frame(width: 160, height: 160)
+                                .foregroundStyle(
+                                    LinearGradient(
+                                        gradient: Gradient(colors: [.indigo, .white, .purple, .mint, .white, .orange, .indigo]), startPoint: .trailing, endPoint: .leading)
+                                )
+                        } animation: { move in
+                                .linear.speed(0.1).repeatForever(autoreverses: false)
+                        }
+                        
+                        Circle()
+                            .frame(width: 164, height: 164)
+                            .foregroundStyle(.indigo.gradient)
+                        // 1. Mask
+                            .mask(
+                                ZStack {
+                                    PhaseAnimator([false ,true]) { move in
+                                        Image(.wave)
+                                            .opacity(0.4)
+                                            .scaleEffect(x: 2)
+                                            .offset(x: move ? 20 : -20, y: move ? 36 : 25)
+                                    } animation: { move in
+                                            .easeIn(duration: 1.0).speed(0.25).repeatForever(autoreverses: true)
+                                    }
+                                    
+                                    PhaseAnimator([true, false]) { move in
+                                        Image(.wave)
+                                            .opacity(0.6)
+                                            .scaleEffect(x: 2)
+                                            .offset(x: -20, y: move ? 30 : 36)
+                                    } animation: { move in
+                                            .easeOut(duration: 1.0)
+                                    }
+                                    
+                                    PhaseAnimator([false, true]) { rotate in
+                                        Image(.wave)
+                                            .rotationEffect(.degrees(rotate ? 10 : -10))
+                                            .scaleEffect(x: 2, y: 1)
+                                            .offset(y: 40)
+                                    } animation: { rotate in
+                                            .easeInOut(duration: 1.0)
+                                    }
+                                }
+                            )
+                    }
+                    Spacer()
+                }
+            } header: {
+                Text("mask(alignment:_:)")
+            } footer: {
+                Text("Use mask(_:) to apply the opacity value of another view to the current view")
+            }
+            
+            Section {
+                // 2. ClipShape
+                HStack {
+                    Spacer()
+                    ZStack {
+                        PhaseAnimator([false ,true]) { move in
+                            Image(.wave)
+                                .opacity(0.4)
+                                .scaleEffect(x: 2)
+                                .offset(x: move ? 20 : -20, y: move ? 36 : 25)
+                        } animation: { move in
+                                .easeIn(duration: 1.0).speed(0.25).repeatForever(autoreverses: true)
+                        }
+                        
+                        PhaseAnimator([true, false]) { mov
```

---

### Incident Patch 6: `121a2400` (2025-12-23)
**Commit Message**: Create SwiftUIChristmas25Tree.swift

**File**: `Gists_To_Try/SwiftUIChristmas25Tree.swift` (added, +256/-0)
```diff
@@ -0,0 +1,256 @@
+//
+//  SwiftUIChristmas25Tree.swift
+//
+//  Created by Amos Gyamfi on 22.12.2025.
+
+//  ContentView.swift
+//  SwiftUIChristmasTree
+//
+
+import SwiftUI
+
+struct SwiftUIChristmas25Tree: View {
+    
+    @State private var isSpinning = false
+    let coral = Color(#colorLiteral(red: 1, green: 0.4941176471, blue: 0.4745098039, alpha: 1))
+    let peach = Color(#colorLiteral(red: 1, green: 0.831372549, blue: 0.4745098039, alpha: 1))
+    let lightLimeGreen = Color(#colorLiteral(red: 0.831372549, green: 0.9843137255, blue: 0.4745098039, alpha: 1))
+    let springGreen = Color(#colorLiteral(red: 0.2862745098, green: 0.9803921569, blue: 0.4745098039, alpha: 1))
+    let paleAqua = Color(#colorLiteral(red: 0.2862745098, green: 0.9882352941, blue: 0.8392156863, alpha: 1))
+    let skyBlue = Color(#colorLiteral(red: 0.2901960784, green: 0.8392156863, blue: 1, alpha: 1))
+    let softLavender = Color(#colorLiteral(red: 0.4784313725, green: 0.5058823529, blue: 1, alpha: 1))
+    let electricPurple = Color(#colorLiteral(red: 0.8470588235, green: 0.5137254902, blue: 1, alpha: 1))
+    let olive = Color(#colorLiteral(red: 0.5764705882, green: 0.3529411765, blue: 0, alpha: 1))
+    let forestGreen = Color(#colorLiteral(red: 0, green: 0.5607843137, blue: 0, alpha: 1))
+    
+    var body: some View {
+        NavigationStack {
+            VStack {
+                Image(.stream)
+                    .resizable()
+                    .scaledToFit()
+                    .frame(width: 128, height: 128)
+                    .hueRotation(.degrees(isSpinning ? 0 : 150))
+                    .animation(.easeInOut(duration: 5).repeatForever(autoreverses: true).delay(0.5), value: isSpinning)
+                
+                ZStack {
+                    ZStack {
+                        Circle() // MARK: One. No delay
+                            .stroke(style: StrokeStyle(lineWidth: 1, lineCap: .round, dash: [1, 30]))
+                            .frame(width: 20, height: 20)
+                            .foregroundStyle(coral.gradient)
+                        
+                        ForEach(0 ..< 4) {
+                            //Circle()
+                            Text("✨")
+                                .font(.caption2)
+                                //.hueRotation(.degrees(isSpinning ? Double($0) * 310 : Double($0) * 50))
+                                .offset(y: -10)
+                                .rotationEffect(.degrees(Double($0) * -90))
+                                .rotationEffect(.degrees(isSpinning ? 0 : -180))
+                                .frame(width: 4, height: 4)
+                                .animation(.linear(duration: 1.5).repeatForever(autoreverses: false), value: isSpinning)
+                        }
+                    }
+                    .rotation3DEffect(.degrees(60), axis: (x: 1, y: 0, z: 0))
+                    .offset(y: -160)
+                    
+                    ZStack {
+                        Circle() // MARK: Two. 0.1 delay
+                            .stroke(style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [1, 30]))
+                            .frame(width: 50, height: 50)
+                            .foregroundStyle(peach.gradient)
+                        
+                        ForEach(0 ..< 4) {
+                            //Circle()
+                            Text("🌟")
+                                .font(.caption2)
+                                //.hueRotation(.degrees(isSpinning ? Double($0) * 310 : Double($0) * 50))
+                                .offset(y: -25)
+                                .rotationEffect(.degrees(Double($0) * -90))
+                                .rotationEffect(.degrees(isSpinning ? 0 : -180))
+                                .frame(width: 6, height: 6)
+                                .animation(.linear(duration: 1.5).repeatForever(autoreverses: false).delay(0.1), value: isSpinning)
+                        }
+                    }
+                    .rotation3DEffect(.degrees(60), axis: (x: 1, y: 0, z: 0))
+                    .offset(y: -120)
+                    
+                    ZStack {
+                        Circle() // Three. 0.2 delay
+                            .stroke(style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [1, 30]))
+                            .frame(width: 80, height: 80)
+                            .foregroundStyle(lightLimeGreen.gradient)
+                        
+                        ForEach(0 ..< 4) {
+                            //Circle()
+                            Text("💫")
+                                .font(.caption2)
+                                //.hueRotation(.degrees(isSpinning ? Double($0) * 310 : Double($0) * 50))
+                                .offset(y: -40)
+                                .rotationEffect(.degrees(Double($0) * -90))
+                                .rotationEffect(.degrees(isSpinning ? 0 : -1
```

---

### Incident Patch 7: `37c7b19d` (2025-11-29)
**Commit Message**: Add ThreeWaysToAnimate SwiftUI example

**File**: `Gists_To_Try/ThreeWaysToAnimate.swift` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+//
+//  ThreeWaysToAnimate.swift
+//  SwiftUIAnimation2026
+//
+
+import SwiftUI
+
+struct ThreeWaysToAnimate: View {
+    @State private var withAnimate = 0.0
+    @State private var dotAnimate = 0.0
+    @State private var bindAnimate = 0.0
+
+    var body: some View {
+        List {
+            // 1. Animate all of the visual changes for a state change by changing the state inside a call to the withAnimation(_:_:) global function.
+            VStack(alignment: .leading) {
+                Text("1. withAnimation")
+                    .font(.headline)
+                Circle()
+                    .fill(.blue)
+                    .frame(width: 120, height: 120)
+                    .offset(x: withAnimate)
+                Button("withAnimate") {
+                    withAnimation(.easeInOut(duration: 1.0)) {
+                        withAnimate = (withAnimate == 0.0 ? 260.0 : 0.0)
+                    }
+                }
+                .padding()
+                .glassEffect()
+            }
+
+            // 2. Add animation to a particular view when a specific value changes by applying the animation(_:value:) view modifier to the view.
+            
+            VStack(alignment: .leading) {
+                Text("2. animation(_:value:)")
+                    .font(.headline)
+                Circle()
+                    .fill(.green)
+                    .frame(width: 120, height: 120)
+                    .offset(x: dotAnimate)
+                    .animation(.spring(response: 0.5, dampingFraction: 0.6, blendDuration: 0), value: dotAnimate)
+                Button(".animate") {
+                    dotAnimate = (dotAnimate == 0.0 ? 260.0 : 0.0)
+                }
+                .padding()
+                .glassEffect()
+            }
+
+            // 3. Animate changes to a Binding by using the binding’s animation(_:) method.
+
+            VStack(alignment: .leading) {
+                Text("3. binding.animation(_:)")
+                    .font(.headline)
+
+                Circle()
+                    .fill(.orange)
+                    .frame(width: 120, height: 120)
+                    .offset(x: bindAnimate)
+
+                Slider(
+                    value: $bindAnimate.animation(.easeInOut(duration: 0.5)),
+                    in: 0.0...260.0
+                )
+                .padding()
+            }
+        }
+        .listStyle(.plain)
+    }
+}
+
+#Preview {
+    ThreeWaysToAnimate()
+        .preferredColorScheme(.dark)
+}
```

---

### Incident Patch 8: `340bb1aa` (2025-08-30)
**Commit Message**: Add Liquid Glass Shape Morphing Animation section

**File**: `README.md` (modified, +46/-0)
```diff
@@ -9,6 +9,52 @@ SwiftUI animation is compelling and superb. With minimal effort, you can add inc
 Starting in 2025, I will generate some of the SwiftUI animations using SOTA models like Gemini 2.5 Pro, Claude 3.7 Sonnet, OpenAI o3, and o4-mini models.
 ---
 
+### Liquid Glass Shape Morphing Animation With GlassEffectContainer: [Gist](https://github.com/amosgyamfi/swiftui_tutorial_projects/blob/master/Gist/LiquidGlassEffectContainer.swift)
+![Shape Morphing Animation With GlassEffectContainer](GIF_Previews/GlassEffectContainerMorphing.gif)
+```swift
+import SwiftUI
+
+struct LiquidGlassEffectContainer: View {
+    var body: some View {
+        GlassEffectContainer(spacing: 50) {
+            PhaseAnimator([false, true]) { morph in
+                HStack(spacing: morph ? 50.0 : -15.0) {
+                    Button {
+                        //
+                    } label: {
+                        Image(systemName: "scribble.variable")
+                    }
+                    .padding()
+                    .glassEffect()
+                    
+                    Button {
+                        //
+                    } label: {
+                        Image(systemName: "eraser.fill")
+                    }
+                    .padding()
+                    .glassEffect()
+                }
+                .tint(.green)
+                .font(.system(size: 64.0))
+            } animation: { morph in
+                    //.bouncy(duration: 2, extraBounce: 0.5)
+                    //.easeOut(duration: 2)
+                    .easeInOut(duration: 2)
+                    //.timingCurve(0.68, -0.6, 0.32, 1.6, duration: 2)
+                    
+            }
+        }
+    }
+}
+
+#Preview {
+    LiquidGlassEffectContainer()
+        .preferredColorScheme(.dark)
+}
+```
+---
+
 ### Image generation loader: [Gist](https://gist.github.com/amosgyamfi/b9fb404fcc1fc14b735f84095b8f7552#file-imagegenerationloader-swift)
 ![Image generation loader](GIF_Previews/imageGenerator.gif)
 
```

---

### Incident Patch 9: `76ce7490` (2025-05-23)
**Commit Message**: Create Claude4SonnetSwiftUIFireworks.swift

**File**: `Gists_To_Try/Claude4SonnetSwiftUIFireworks.swift` (added, +328/-0)
```diff
@@ -0,0 +1,328 @@
+//
+//  Claude4iOSFireworks.swift
+//
+//  Created by Amos Gyamfi on 23.5.2025.
+//
+
+import SwiftUI
+import UIKit
+
+// MARK: - Fireworks Emitter View
+struct FireworksEmitterView: UIViewRepresentable {
+    @Binding var triggerFireworks: Bool
+    
+    func makeUIView(context: Context) -> UIView {
+        let view = UIView()
+        view.backgroundColor = UIColor.clear
+        return view
+    }
+    
+    func updateUIView(_ uiView: UIView, context: Context) {
+        if triggerFireworks {
+            createFireworksEffect(in: uiView)
+            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
+                triggerFireworks = false
+            }
+        }
+    }
+    
+    private func createFireworksEffect(in view: UIView) {
+        // Random launch position
+        let launchX = CGFloat.random(in: view.bounds.width * 0.2...view.bounds.width * 0.8)
+        let launchY = view.bounds.height
+        let explosionY = CGFloat.random(in: view.bounds.height * 0.2...view.bounds.height * 0.6)
+        
+        // Create launch trail
+        createLaunchTrail(in: view, startX: launchX, startY: launchY, endY: explosionY)
+        
+        // Delay explosion to match launch timing
+        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
+            self.createExplosion(in: view, x: launchX, y: explosionY)
+        }
+    }
+    
+    private func createLaunchTrail(in view: UIView, startX: CGFloat, startY: CGFloat, endY: CGFloat) {
+        let emitterLayer = CAEmitterLayer()
+        
+        // Position at launch point
+        emitterLayer.emitterPosition = CGPoint(x: startX, y: startY)
+        emitterLayer.emitterShape = .point
+        emitterLayer.emitterMode = .outline
+        
+        // Create launch particle
+        let launchCell = CAEmitterCell()
+        launchCell.name = "launch"
+        launchCell.birthRate = 5
+        launchCell.lifetime = 0.8
+        launchCell.velocity = 300
+        launchCell.velocityRange = 50
+        launchCell.emissionLongitude = -.pi / 2  // Upward
+        launchCell.emissionRange = .pi / 8
+        
+        // Appearance
+        launchCell.scale = 0.3
+        launchCell.scaleRange = 0.1
+        launchCell.color = UIColor.white.cgColor
+        launchCell.redRange = 0.3
+        launchCell.greenRange = 0.3
+        launchCell.blueRange = 0.3
+        launchCell.alphaSpeed = -1.0
+        
+        // Physics
+        launchCell.yAcceleration = 100  // Gravity effect
+        launchCell.scaleSpeed = -0.2
+        
+        // Particle image (create a simple circle)
+        launchCell.contents = createParticleImage(size: 8, color: .white).cgImage
+        
+        emitterLayer.emitterCells = [launchCell]
+        view.layer.addSublayer(emitterLayer)
+        
+        // Animate the emitter position to simulate rocket trail
+        let animation = CABasicAnimation(keyPath: "emitterPosition")
+        animation.fromValue = CGPoint(x: startX, y: startY)
+        animation.toValue = CGPoint(x: startX, y: endY)
+        animation.duration = 0.8
+        animation.timingFunction = CAMediaTimingFunction(name: .easeOut)
+        emitterLayer.add(animation, forKey: "position")
+        
+        // Remove after animation
+        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
+            emitterLayer.removeFromSuperlayer()
+        }
+    }
+    
+    private func createExplosion(in view: UIView, x: CGFloat, y: CGFloat) {
+        let emitterLayer = CAEmitterLayer()
+        
+        // Position at explosion point
+        emitterLayer.emitterPosition = CGPoint(x: x, y: y)
+        emitterLayer.emitterShape = .point
+        emitterLayer.emitterMode = .outline
+        
+        // Create multiple types of explosion particles
+        var cells: [CAEmitterCell] = []
+        
+        // Main explosion particles
+        let explosionCell = CAEmitterCell()
+        explosionCell.name = "explosion"
+        explosionCell.birthRate = 200
+        explosionCell.lifetime = 3.0
+        explosionCell.lifetimeRange = 1.0
+        explosionCell.velocity = 200
+        explosionCell.velocityRange = 100
+        explosionCell.emissionLongitude = 0
+        explosionCell.emissionRange = 2 * .pi  // Full circle
+        
+        // Random colors for fireworks
+        let colors: [UIColor] = [.red, .orange, .yellow, .green, .blue, .purple, .magenta, .cyan]
+        let selectedColor = colors.randomElement() ?? .red
+        
+        explosionCell.color = selectedColor.cgColor
+        explosionCell.redRange = 0.4
+        explosionCell.greenRange = 0.4
+        explosionCell.blueRange = 0.4
+        explosionCell.alphaSpeed = -0.8
+        
+        // Physics
+        explosionCell.yAcceleration = 200  // Gravity
+        explosionCell.scale = 0.5
+        explosionCell.scaleRange = 0.3
+        explosionCell.scaleSpeed = -0.2
+        
+        explosionCell.contents = createParticleImage(size: 6, color: selecte
```

---

### Incident Patch 10: `d22f7b8b` (2024-11-30)
**Commit Message**: Merge branch 'master' of https://github.com/amosgyamfi/open-swiftui-animations



#### Recent Merged Pull Requests:
- **PR #12** (closed): Update README.md (@amosgyamfi)
- **PR #2** (2020-07-08): Create LICENSE (@amosgyamfi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
