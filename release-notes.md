## Rename connected Outlook accounts

A small follow-up to 1.10.0.

- **Rename accounts** — give each connected Outlook account a recognizable name in settings, so it is clear which account is which.
- **Better automatic names** — the account name and email are now filled in automatically on connect (added the `User.Read` permission). Existing connections show "Account" until you reconnect, or you can just type your own name.

If you self-host your own Client ID, add the `User.Read` delegated permission in your Azure app (it is usually present by default).
