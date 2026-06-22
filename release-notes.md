## Outlook tokens stored per device

A privacy/robustness follow-up to 1.10.1.

- **Tokens no longer sync** — Outlook sign-in tokens are now kept in device-local storage instead of `data.json`. Obsidian Sync no longer copies them across devices, which also prevents refresh-token conflicts between devices.
- Your account list and calendar selection still sync as before — you just sign in once per device.
- Existing tokens migrate automatically on first load; no action needed.
