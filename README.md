# Privacy Origin

A Chrome extension that educates users about data tracking and privacy risks while browsing the web. Unlike traditional tracker blockers, Privacy Origin **does not block functionality**—instead, it reveals what websites and third parties collect about you in real-time.

## Chrome Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (top-right corner)
4. Click **Load unpacked** and select the extension directory
5. The Privacy Origin icon will appear in your toolbar

## Popup Dashboard

The popup displays real-time tracking activity for the current website:

- **Network Activity**: Interactive graph showing request frequency over time, with tracker categorization (Analytics, Advertising, Social)
- **Cookies**: Real-time detection and logging of all cookies set by first-party and third-party domains
- **Privacy Threats**: Detects geolocation requests, browser fingerprinting attempts (canvas, WebGL), and form tracking
- **Global Stats**: Aggregated tracking patterns across all visited websites with per-tracker statistics

## Privacy Report

Generate comprehensive reports of all collected tracking data:

- Global statistics showing which trackers appear most frequently across websites
- Learn more about the different kinds of tracking activity and how to combat them
- Clear all collected data from this browser session
