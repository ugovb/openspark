// Polish translations: cli. Keys are the English source strings used with t() / tp().
import type { Dictionary } from '../../i18n'

const dict: Dictionary = {
  strings: {
    // the same in Polish
    'newsl.': 'newsl.',
    // ── help (openmail help) ──
    'openmail {version} — OpenMail from the command line (local times with UTC offset)':
      'openmail {version} — OpenMail z wiersza poleceń (czasy lokalne z przesunięciem UTC)',
    [`Reading:
  openmail accounts                              accounts, agent access levels
  openmail folders [account]                     folders with counts
  openmail emails [mailbox] [--filter q] [--page N] [--page-size N] [--unread]
       mailbox: Inbox|Sent|Archive|Trash|Spam|pinned|snoozed|aside|reminders|newsenders|
                people|notifications|newsletters|account@x.com|account@x.com:Folder|<smart folder>
  openmail search ["topic"] [--filter q] [--in account|account:Folder] [--page N]   (all folders)
  openmail thread <ID|tID> [--html]              whole thread with bodies and attachments
  openmail attachment <ID> [--save file] [--stream]
  openmail contacts [query]  ·  openmail templates  ·  openmail template <ID|name>`]: `Czytanie:
  openmail accounts                              konta, poziomy dostępu agentów
  openmail folders [konto]                       foldery z licznikami
  openmail emails [skrzynka] [--filter q] [--page N] [--page-size N] [--unread]
       skrzynka: Inbox|Sent|Archive|Trash|Spam|pinned|snoozed|aside|reminders|newsenders|
                 people|notifications|newsletters|konto@x.pl|konto@x.pl:Folder|<inteligentny folder>
  openmail search ["temat"] [--filter q] [--in konto|konto:Folder] [--page N]   (wszystkie foldery)
  openmail thread <ID|tID> [--html]              cały wątek z treścią i załącznikami
  openmail attachment <ID> [--save plik] [--stream]
  openmail contacts [fraza]  ·  openmail templates  ·  openmail template <ID|nazwa>`,
    [`Writing and sending (draft IDs never change):
  openmail draft --to a@b.com [--cc ..] [--bcc ..] --subject "…" --body "markdown…"
             [--reply-to ID [--reply-all]] [--forward ID] [--account account] [--attach file]
             [--template name --placeholder "Field=value"] [--no-signature] [--edit ID]
  openmail draft --delete ID
  openmail drafts  ·  openmail scheduled
  openmail send <ID> [--at "tomorrow 9:00"] [--remind "in 3 days"]   sends and waits for SMTP confirmation
  openmail unschedule <ID>                       cancels a scheduled send (back to drafts)`]: `Pisanie i wysyłka (stałe ID wersji roboczych):
  openmail draft --to a@b.pl [--cc ..] [--bcc ..] --subject "…" --body "markdown…"
             [--reply-to ID [--reply-all]] [--forward ID] [--account konto] [--attach plik]
             [--template nazwa --placeholder "Pole=wartość"] [--no-signature] [--edit ID]
  openmail draft --delete ID
  openmail drafts  ·  openmail scheduled
  openmail send <ID> [--at "jutro 9:00"] [--remind "za 3 dni"]   wysyła i czeka na potwierdzenie SMTP
  openmail unschedule <ID>                       anuluje zaplanowaną wysyłkę (wraca do wersji roboczych)`,
    [`Organizing (message ID or t<thread ID>, several allowed):
  openmail action archive|inbox|trash|delete-forever|spam|not-spam|read|unread|pin|unpin|
              mute|unmute|aside|unaside|priority|unpriority|unsubscribe <ID...>
  openmail action snooze <ID...> --until "mon 8:00"   ·  openmail action unsnooze <ID...>
  openmail action remind <ID...> --at "in 3 days" [--if-no-reply]  ·  openmail action unremind <ID...>
  openmail action move <ID...> --folder "account@x.com:Folder"  ·  openmail action label|unlabel <ID...> --label X
  openmail sender accept|block|unblock|vip|unvip <email|@domain...>
  openmail sender category <email...> people|notification|newsletter`]: `Porządkowanie (ID wiadomości albo t<ID wątku>, można kilka):
  openmail action archive|inbox|trash|delete-forever|spam|not-spam|read|unread|pin|unpin|
              mute|unmute|aside|unaside|priority|unpriority|unsubscribe <ID...>
  openmail action snooze <ID...> --until "pon 8:00"   ·  openmail action unsnooze <ID...>
  openmail action remind <ID...> --at "za 3 dni" [--if-no-reply]  ·  openmail action unremind <ID...>
  openmail action move <ID...> --folder "konto@x.pl:Folder"  ·  openmail action label|unlabel <ID...> --label X
  openmail sender accept|block|unblock|vip|unvip <email|@domena...>
  openmail sender category <email...> people|notification|newsletter`,
    [`Calendar:
  openmail events [--from "today"] [--to "in 7 days"]  ·  openmail availability [--days 5] [--duration 30]
  openmail event create --title "…" --start "tomorrow 10:00" [--end "tomorrow 11:00"] [--attendee a@b.com] [--location …]
  openmail event delete <ID>  ·  openmail invite <message ID>  ·  openmail rsvp <message ID> accept|maybe|decline`]: `Kalendarz:
  openmail events [--from "dziś"] [--to "za 7 dni"]  ·  openmail availability [--days 5] [--duration 30]
  openmail event create --title "…" --start "jutro 10:00" [--end "jutro 11:00"] [--attendee a@b.pl] [--location …]
  openmail event delete <ID>  ·  openmail invite <ID wiadomości>  ·  openmail rsvp <ID wiadomości> accept|maybe|decline`,
    [`AI (Ollama or Claude, per settings):
  openmail ai summarize <ID|tID>  ·  openmail ai reply <ID|tID> [--instructions "…"]  ·  openmail ai ask "question"`]: `AI (Ollama lub Claude wg ustawień):
  openmail ai summarize <ID|tID>  ·  openmail ai reply <ID|tID> [--instructions "…"]  ·  openmail ai ask "pytanie"`,
    [`Other:
  openmail status · openmail sync [account] · openmail history [--limit N] · openmail daemon (sync without a window)
  openmail serve [--port 8787]   home server (e.g. Raspberry Pi): 24/7 engine + API + web interface
  openmail server pair | devices | revoke <ID>    pairing codes and paired devices
  openmail server account | reset-password | reset-account --yes | 2fa-off | sign-out-all | pairing on|off
                                              the account of the home server (recovery on the NAS)
  openmail mcp   (MCP server on stdio for Claude Code / Claude Desktop)
Global: --json (machine-readable data), --no-sync (don't fetch new mail first)`]: `Inne:
  openmail status · openmail sync [konto] · openmail history [--limit N] · openmail daemon (synchronizacja bez okna)
  openmail serve [--port 8787]   serwer domowy (np. Raspberry Pi): silnik 24/7 + API + interfejs WWW
  openmail server pair | devices | revoke <ID>    kody parowania i sparowane urządzenia
  openmail server account | reset-password | reset-account --yes | 2fa-off | sign-out-all | pairing on|off
                                              konto serwera domowego (odzyskiwanie na NAS)
  openmail mcp   (serwer MCP na stdio dla Claude Code / Claude Desktop)
Globalne: --json (dane maszynowe), --no-sync (bez dociągania poczty)`,

    // ── errors and messages ──
    'Could not understand the date for {label}: "{input}". Examples: "tomorrow 9:00", "fri 14:30", "in 2 hours", "2026-10-20 09:15".':
      'Nie rozumiem daty dla {label}: „{input}”. Przykłady: "jutro 9:00", "pt 14:30", "za 2 godziny", "2026-10-20 09:15".',
    'No message with ID {id} (give threads as t<ID>)': 'Nie ma wiadomości o ID {id} (wątki podawaj jako t<ID>)',
    'Invalid ID: {id}': 'Nieprawidłowe ID: {id}',
    'Give a message ID or a thread ID (t<ID>)': 'Podaj ID wiadomości lub wątku (t<ID>)',
    'No account {email}': 'Nie ma konta {email}',
    'Account {email} has no folder "{folder}" (see: openmail folders {email})': 'Konto {email} nie ma folderu „{folder}” (zobacz: openmail folders {email})',
    'Unknown mailbox "{name}". Use: Inbox, Sent, Archive, Trash, Spam, pinned, snoozed, aside, reminders, newsenders, account@x.com or account@x.com:Folder':
      'Nieznana skrzynka „{name}”. Użyj: Inbox, Sent, Archive, Trash, Spam, pinned, snoozed, aside, reminders, newsenders, konto@x.pl lub konto@x.pl:Folder',
    'The app is not running — fetching new mail…': 'Aplikacja nie działa — pobieram nowe wiadomości…',
    'Error: {message}': 'Błąd: {message}',
    'Unknown command "{cmd}". See: openmail help': 'Nieznane polecenie „{cmd}”. Zobacz: openmail help',

    // ── thread list (emails, search) ──
    Me: 'Ja',
    person: 'osoba',
    'notif.': 'powiad.',
    THREAD: 'WĄTEK',
    DATE: 'DATA',
    FROM: 'OD',
    SUBJECT: 'TEMAT',
    'CAT.': 'KAT.',
    FLAGS: 'FLAGI',
    ACCOUNT: 'KONTO',
    'New senders awaiting a decision: {n} (openmail emails newsenders)': 'Nowi nadawcy czekający na decyzję: {n} (openmail emails newsenders)',
    'Page {page}. Flags: U unread, P pinned, ! priority, A attachment, S snoozed, R reminder, N new sender, D draft, M muted, B set aside':
      'Strona {page}. Flagi: U nieprz., P przypięty, ! priorytet, A załącznik, S odłożony, R przypomnienie, N nowy nadawca, D wersja robocza, M wyciszony, B na boku',
    'Give a topic or --filter': 'Podaj temat albo --filter',
    'ID: {id} (thread t{thread}) · {date} · {account} · {folder}\nFrom: {from}\nSubject: {subject}':
      'ID: {id} (wątek t{thread}) · {date} · {account} · {folder}\nOd: {from}\nTemat: {subject}',
    'Nothing found.': 'Nic nie znaleziono.',
    'Threads found: {total} (page {page})': 'Znaleziono wątków: {total} (strona {page})',

    // ── thread ──
    'Give a message ID or t<thread ID>': 'Podaj ID wiadomości albo t<ID wątku>',
    'Thread does not exist': 'Wątek nie istnieje',
    'Warning: not all message bodies were downloaded ({error})': 'Uwaga: nie pobrano wszystkich treści ({error})',
    'Thread t{id}: {subject}': 'Wątek t{id}: {subject}',
    'Account: {account} · messages: {n} · category: {category}': 'Konto: {account} · wiadomości: {n} · kategoria: {category}',
    pinned: 'przypięty',
    'snoozed until {time}': 'odłożony do {time}',
    'reminder {time}': 'przypomnienie {time}',
    'labels: {labels}': 'etykiety: {labels}',
    UNREAD: 'NIEPRZECZYTANA',
    'From: {from}': 'Od: {from}',
    'To: {to}': 'Do: {to}',
    'Cc: {cc}': 'DW: {cc}',
    'Bcc: {bcc}': 'UDW: {bcc}',
    'Subject: {subject}': 'Temat: {subject}',
    '📅 Contains an invitation (openmail invite {id})': '📅 Zawiera zaproszenie (openmail invite {id})',
    '(no content)': '(brak treści)',
    'Attachments:': 'Załączniki:',
    '(not downloaded — openmail attachment {id})': '(nie pobrany — openmail attachment {id})',
    NAME: 'NAZWA',
    SIZE: 'ROZMIAR',
    TYPE: 'TYP',
    PATH: 'ŚCIEŻKA',
    'DRAFT ID: {id} · {status}': 'WERSJA ROBOCZA ID: {id} · {status}',
    'send at {time}': 'wysyłka {time}',

    // ── attachment ──
    'Give an attachment ID (the ID column in openmail thread)': 'Podaj ID załącznika (kolumna ID w openmail thread)',
    'ID: {id}\nName: {name}\nSize: {size}\nType: {type}\nPath: {path}\nMessage: {message}':
      'ID: {id}\nNazwa: {name}\nRozmiar: {size}\nTyp: {type}\nŚcieżka: {path}\nWiadomość: {message}',

    // ── accounts, folders, contacts, templates ──
    'no access': 'brak',
    read: 'odczyt',
    triage: 'porządkowanie',
    send: 'wysyłka',
    'AGENT ACCESS': 'DOSTĘP AGENTÓW',
    SYNC: 'SYNCHRONIZACJA',
    ERROR: 'BŁĄD',
    'FOLDER (identifier)': 'FOLDER (identyfikator)',
    ROLE: 'ROLA',
    TOTAL: 'WSZYSTKIE',
    'UNREAD THREADS': 'NIEPRZ. WĄTKI',
    EMAIL: 'E-MAIL',
    CATEGORY: 'KATEGORIA',
    SENT: 'WYSŁ.',
    RECEIVED: 'ODEBR.',
    LAST: 'OSTATNIO',
    FIELDS: 'POLA',
    MODIFIED: 'ZMIENIONY',
    'ID: {id}\nName: {name}\nSubject: {subject}\nTo: {to}': 'ID: {id}\nNazwa: {name}\nTemat: {subject}\nDo: {to}',
    'Fields:': 'Pola:',
    '(none)': '(brak)',

    // ── drafts, sending ──
    TO: 'DO',
    UPDATED: 'ZMIENIONA',
    'SEND AT': 'WYSYŁKA',
    'Cancel: openmail unschedule <ID>': 'Anulowanie: openmail unschedule <ID>',
    'Draft {id} deleted.': 'Usunięto wersję roboczą {id}.',
    'File not found: {path}': 'Nie ma pliku {path}',
    'File {path} is larger than 25 MB': 'Plik {path} ma ponad 25 MB',
    file: 'plik',
    'Status: draft (the ID will not change)': 'Status: wersja robocza (ID się nie zmieni)',
    'Attachments: {list}': 'Załączniki: {list}',
    'Send: openmail send {id}  ·  Open: openmail://draft/{id}': 'Wysyłka: openmail send {id}  ·  Otwórz: openmail://draft/{id}',
    'Give a draft ID': 'Podaj ID wersji roboczej',
    'Warning: the app is not running — the message will go out only when you start OpenMail or `openmail daemon`.':
      'Uwaga: aplikacja nie działa — wiadomość wyjdzie dopiero, gdy uruchomisz OpenMail albo `openmail daemon`.',
    'Scheduled: {subject}\nSend at: {time}\nCancel: openmail unschedule {id}': 'Zaplanowano: {subject}\nWysyłka: {time}\nAnulowanie: openmail unschedule {id}',
    'Sent: {subject} ({time})': 'Wysłano: {subject} ({time})',
    'Not sent (status: {status}): {error}': 'Nie wysłano (status: {status}): {error}',
    'Not sent (status: {status})': 'Nie wysłano (status: {status})',
    'Send cancelled. "{subject}" is a draft again (ID {id}).': 'Anulowano wysyłkę. „{subject}” jest znowu wersją roboczą (ID {id}).',

    // ── actions, senders ──
    'Give an action (openmail help)': 'Podaj akcję (openmail help)',
    '--folder must point to an account folder, e.g. account@x.com:Projects': '--folder musi wskazywać folder konta, np. konto@x.pl:Projekty',
    'Give --label': 'Podaj --label',
    'Unknown action "{action}"': 'Nieznana akcja „{action}”',
    'Action partly failed: {errors}': 'Akcja częściowo nieudana: {errors}',
    'OK: {result} (threads: {threads})': 'OK: {result} (wątki: {threads})',
    'Category: people|notification|newsletter': 'Kategoria: people|notification|newsletter',
    'Give address(es) or @domain': 'Podaj adres(y) lub @domenę',

    // ── calendar, AI ──
    '{date} (all day)': '{date} (cały dzień)',
    START: 'POCZĄTEK',
    END: 'KONIEC',
    EVENT: 'WYDARZENIE',
    CALENDAR: 'KALENDARZ',
    'MY RSVP': 'MOJA ODP.',
    MEETING: 'SPOTKANIE',
    'No free slots in this range.': 'Brak wolnych terminów w tym zakresie.',
    'Give --title and --start': 'Podaj --title i --start',
    'Created event {id}: {title} · {time}': 'Utworzono wydarzenie {id}: {title} · {time}',
    'Event deleted.': 'Usunięto wydarzenie.',
    'This message does not contain an invitation.': 'Ta wiadomość nie zawiera zaproszenia.',
    'openmail rsvp <message ID> accept|maybe|decline': 'openmail rsvp <ID wiadomości> accept|maybe|decline',
    'Invitation response sent.': 'Wysłano odpowiedź na zaproszenie.',
    'Sources: {list}': 'Źródła: {list}',

    // ── status, sync, daemon, history ──
    'Sync engine: running ({owner}, pid {pid})': 'Silnik synchronizacji: działa ({owner}, pid {pid})',
    'Sync engine: NOT running — start the app or `openmail daemon`': 'Silnik synchronizacji: NIE działa — uruchom aplikację albo `openmail daemon`',
    '{email}: last sync {time} — ERROR: {error}': '{email}: ostatnia synchronizacja {time} — BŁĄD: {error}',
    '{email}: last sync {time}': '{email}: ostatnia synchronizacja {time}',
    'Queued operations: {n}': 'Operacje w kolejce: {n}',
    'Syncing {email}…': 'Synchronizuję {email}…',
    'Done.': 'Gotowe.',
    'Sync is already running (the app or another daemon).': 'Synchronizacja już działa (aplikacja albo inny daemon).',
    'OpenMail daemon is running (Ctrl+C to stop).': 'OpenMail daemon działa (Ctrl+C kończy).',
    WHEN: 'KIEDY',
    WHO: 'KTO',
    ACTION: 'AKCJA',
    TARGET: 'CEL',
    RESULT: 'WYNIK',
    DETAILS: 'SZCZEGÓŁY',

    // ── home server (openmail serve / openmail server) ──
    'A sync engine is already running on this computer (the app or a daemon). Close it before starting the server.':
      'Na tym komputerze działa już silnik synchronizacji (aplikacja albo daemon). Zamknij go przed uruchomieniem serwera.',
    [`OpenMail — home server is running.

Address:  {addresses}

Sign in with your email and password (and your authenticator code).
Forgot it? openmail server reset-password · Account: openmail server account · Ctrl+C to stop.`]: `OpenMail — serwer domowy działa.

Adres:  {addresses}

Zaloguj się e-mailem i hasłem (oraz kodem z aplikacji uwierzytelniającej).
Zapomniane hasło? openmail server reset-password · Konto: openmail server account · Ctrl+C, aby zatrzymać.`,
    [`OpenMail — home server is running.

Address:  {addresses}
Setup code: {code}

Open the address in a browser (or in the OpenMail app) and create your account with this code: email + password, then turn on two-step verification in Settings → Home server.
Choose the code yourself with OPENMAIL_SETUP_CODE. Device list: openmail server devices · Ctrl+C to stop.`]: `OpenMail — serwer domowy działa.

Adres:  {addresses}
Kod konfiguracji: {code}

Otwórz adres w przeglądarce (albo w aplikacji OpenMail) i utwórz konto za pomocą tego kodu: e-mail + hasło, potem włącz weryfikację dwuetapową w Ustawienia → Serwer domowy.
Kod możesz wybrać sam przez OPENMAIL_SETUP_CODE. Lista urządzeń: openmail server devices · Ctrl+C, aby zatrzymać.`,
    'Pairing code: {code}\nValid until: {time} (single use)': 'Kod parowania: {code}\nWażny do: {time} (jednorazowy)',
    DEVICE: 'URZĄDZENIE',
    PAIRED: 'SPAROWANE',
    'LAST SEEN': 'OSTATNIO',
    'Give a device ID (openmail server devices)': 'Podaj ID urządzenia (openmail server devices)',
    'Access revoked.': 'Odebrano dostęp.',
    'No such device.': 'Nie ma takiego urządzenia.',
    'Account: {email}\nTwo-step verification: {state}\nRecovery codes left: {n}\nPairing codes: {pairing}': 'Konto: {email}\nWeryfikacja dwuetapowa: {state}\nPozostałe kody zapasowe: {n}\nKody parowania: {pairing}',
    'allowed': 'dozwolone',
    'off': 'wyłączona',
    'on': 'włączona',
    'switched off': 'wyłączone',
    'No account yet. Open the server address in a browser and create it with a pairing code (openmail server pair).': 'Brak konta. Otwórz adres serwera w przeglądarce i utwórz je za pomocą kodu parowania (openmail server pair).',
    'Pairing codes are allowed.': 'Kody parowania są dozwolone.',
    'Pairing codes are switched off.': 'Kody parowania są wyłączone.',
    'Two-step verification is off. Turn it on again in Settings → Home server.': 'Weryfikacja dwuetapowa jest wyłączona. Włącz ją ponownie w Ustawieniach → Serwer domowy.',
    '{n} devices signed out.': 'Wylogowano urządzenia: {n}.',
    'New password: ': 'Nowe hasło: ',
    'Repeat the password: ': 'Powtórz hasło: ',
    'Password changed for {email}. The account is unlocked.': 'Zmieniono hasło dla {email}. Konto jest odblokowane.',
    'Account deleted. Open the server address in a browser and create a new one with this pairing code (valid 15 min): {code}': 'Konto usunięte. Otwórz adres serwera w przeglądarce i utwórz nowe za pomocą tego kodu parowania (ważny 15 min): {code}',
    'This deletes the account {email} and signs every device out. Mail accounts and messages are kept. Run again with --yes to confirm.': 'To usuwa konto {email} i wylogowuje wszystkie urządzenia. Konta pocztowe i wiadomości zostają. Uruchom ponownie z --yes, aby potwierdzić.',
    'The account already exists: sign in with its email and password.': 'Konto już istnieje: zaloguj się jego e-mailem i hasłem.',
    'Setup code: {code}': 'Kod konfiguracji: {code}',
  },
  plurals: {},
}
export default dict
