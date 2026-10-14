# Synology (DS224+) + iPhone + Mac

Goal: mail server in Docker on the NAS, web app on the iPhone, native app on the Mac, all sharing one account set.

## 1. Run the server in Container Manager

Over SSH (or paste `deploy/docker-compose.synology.yml` into *Container Manager → Project*):

```bash
sudo mkdir -p /volume1/docker/openspark && sudo chown 1000:1000 /volume1/docker/openspark
sudo docker compose -f deploy/docker-compose.synology.yml up -d
sudo docker exec openspark-mail octo server pair      # prints a one-time code, valid 15 minutes
```

The first time, that code is only used to create **your account** (step 3). Nobody else can create one: sign-up closes
as soon as the account exists.

The image `ghcr.io/ugovb/openspark` is built by GitHub Actions for amd64 + arm64: no build on the NAS.
If the package is private, make it public in GitHub (*Packages → Package settings*) or `docker login ghcr.io`.

## 2. HTTPS with the DSM reverse proxy

1. *Control Panel → Login Portal → Advanced → Reverse Proxy → Create*
   - Source: HTTPS, `mail.your-domain.tld`, port 443
   - Destination: HTTP, `localhost`, port 8787
   - Custom Header tab → *Create → WebSocket*  (live new-mail updates)
2. *Control Panel → Security → Certificate*: add a Let's Encrypt certificate for the name and assign it to this proxy rule.
3. Router: forward only TCP 443 to the NAS. **Never forward 8787** (the compose file binds it to localhost on purpose).
4. DSM firewall: allow 443 from your country only; keep *Auto Block* on.

`OCTO_TRUST_PROXY=1` (set in the compose file) makes the server read the real client address from the proxy,
so the "10 failed codes → locked for 10 minutes" rule hits the attacker, not everybody.

## 3. Your account (email, password, two-step verification)

All the mail accounts you connect live on the NAS (SQLite database in `/volume1/docker/openspark`, nothing in the cloud).
You sign in to them with **one OpenSpark account**:

1. Open `https://mail.your-domain.tld` in a browser. With no account yet, the page asks for the pairing code from step 1,
   an email address and a password (10 characters or more). That creates the owner account and signs the browser in.
   Already paired a device before? Create the account from it instead: *Settings → Home server → My account*.
2. *Settings → Home server → My account → Two-step verification → Turn on*: scan the QR code with Google Authenticator,
   1Password, Authy… type the first code, then **save the 10 recovery codes** somewhere outside the NAS.
3. From now on every new device signs in with email + password + the 6-digit code. Pairing codes are switched off
   (they can be allowed again in *My account*).

After 10 wrong attempts the account is locked for 15 minutes. Changing the password, the 2FA settings or signing out
everywhere asks for the password (and a code) again.

### Lost your password or phone?

Being able to run a command on the NAS is the proof that the server is yours:

```bash
sudo docker exec -it openspark-mail octo server account          # who is the owner, is 2FA on
sudo docker exec -it openspark-mail octo server reset-password   # new password (also unlocks the account)
sudo docker exec openspark-mail octo server 2fa-off              # lost phone and recovery codes
sudo docker exec openspark-mail octo server sign-out-all         # sign every device out
sudo docker exec openspark-mail octo server pairing on           # allow pairing codes again (off = default)
```

## 4. iPhone

Safari → `https://mail.your-domain.tld` → email, password, code → Share → *Add to Home Screen*.
It then opens full screen like an app. Each device gets its own key; list or revoke them in *My account*
(or `octo server devices` / `octo server revoke <ID>`).

## 5. Mac (Apple Silicon)

Download the DMG from the repository's *Releases* (or the `octopus-mail-macos-arm64` artifact of the *Release* workflow),
drag the app to *Applications*, then once:

```bash
xattr -dr com.apple.quarantine "/Applications/Octopus Mail.app"
```

(The app is ad-hoc signed, not notarized: no paid Apple developer account.)
Open it → *Settings → Home server* → address `https://mail.your-domain.tld` → email, password (and code).

## Security

The login page is on the internet, protected by email + password (scrypt) + a TOTP code, per-IP and per-account lockout
and per-device tokens. The TOTP secret is encrypted in the database; mailbox passwords stay in `secrets.json` (owner-only
file) so the server can sync while you are signed out.
For a stricter setup keep port 443 closed and use Tailscale (Synology package + iPhone app) with the same URL on the tailnet.
Back up `/volume1/docker/openspark` (database, secrets, attachments).
