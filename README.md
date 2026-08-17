# Cine Effect Portfolio

A cinematic, 3D scroll-triggered developer portfolio built with **HTML5**, **Vanilla CSS**, **Tailwind CSS**, and **GSAP (ScrollTrigger & ScrollToPlugin)**.

---

## 🎨 UI Theme Color Palette

### Core Color Palette

| Token / Type | Hex / Value | Visual Preview | Usage |
| :--- | :--- | :--- | :--- |
| **Background Dark** | `#08080a` | `■ #08080a` | Main page background (Deep Space Dark) |
| **Accent Purple** | `#a855f7` | `■ #a855f7` | Primary buttons, active dots, glow shadows, timeline nodes |
| **Accent Cyan / Blue** | `#06b6d4` | `■ #06b6d4` | Secondary accents, mouse scroll wheel indicator, secondary gradient |
| **Accent Blue (Laser)**| `#3b82f6` | `■ #3b82f6` | Timeline circuit laser beam & project card highlights |
| **Text Primary** | `#ffffff` | `■ #ffffff` | Titles, primary headings, bold text |
| **Text Secondary** | `rgba(255, 255, 255, 0.6)` | `■ #ffffff99` | Subtitles, body descriptions, navigation links |

---

### Glassmorphism & UI Surfaces

| Element | Color Value | Description |
| :--- | :--- | :--- |
| **Card Background** | `rgba(18, 18, 22, 0.6)` | Semi-transparent dark cards with backdrop blur |
| **Card Border** | `rgba(255, 255, 255, 0.08)` | Subtle high-tech frosted border |
| **Purple Glow Shadow** | `rgba(168, 85, 247, 0.35)` | Neon purple drop-shadow on buttons & cards |
| **Cyan Glow Shadow** | `rgba(6, 182, 212, 0.35)` | Neon cyan drop-shadow on interactive cards |

---

### 🌈 Signature Gradients

- **Purple to Cyan Gradient (Primary Accent):**
  ```css
  background: linear-gradient(135deg, #a855f7, #06b6d4);
  ```
- **Timeline Laser Path Gradient:**
  ```css
  background: linear-gradient(135deg, #a855f7 0%, #3b82f6 100%);
  ```
- **Preloader Background Glow:**
  ```css
  background: radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, rgba(6, 182, 212, 0.12) 45%, transparent 70%);
  ```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```

### 3. Build for Production
```bash
npm run build
```
