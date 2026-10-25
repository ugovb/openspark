// French translations: cli. Keys are the English source strings used with t() / tp().
// Commands, flags and date examples in the help stay as typed (the date parser reads English and Polish).
import type { Dictionary } from '../../i18n'

const dict: Dictionary = {
  strings: {
    // the same in French
    'newsl.': 'newsl.',
    // ── help (openmail help) ──
    'openmail {version} — OpenMail from the command line (local times with UTC offset)':
      'openmail {version} — OpenMail en ligne de commande (heures locales avec décalage UTC)',
    [`Reading:
  openmail accounts                              accounts, agent access levels
  openmail folders [account]                     folders with counts
  openmail emails [mailbox] [--filter q] [--page N] [--page-size N] [--unread]
       mailbox: Inbox|Sent|Archive|Trash|Spam|pinned|snoozed|aside|reminders|newsenders|
                people|notifications|newsletters|account@x.com|account@x.com:Folder|<smart folder>
  openmail search ["topic"] [--filter q] [--in account|account:Folder] [--page N]   (all folders)
  openmail thread <ID|tID> [--html]              whole thread with bodies and attachments
  openmail attachment <ID> [--save file] [--stream]
  openmail contacts [query]  ·  openmail templates  ·  openmail template <ID|name>`]: `Lecture :
  openmail accounts                              comptes, niveaux d’accès des agents
  openmail folders [compte]                      dossiers avec compteurs
  openmail emails [boîte] [--filter q] [--page N] [--page-size N] [--unread]
       boîte : Inbox|Sent|Archive|Trash|Spam|pinned|snoozed|aside|reminders|newsenders|
               people|notifications|newsletters|compte@x.fr|compte@x.fr:Dossier|<dossier intelligent>
  openmail search ["sujet"] [--filter q] [--in compte|compte:Dossier] [--page N]   (tous les dossiers)
  openmail thread <ID|tID> [--html]              conversation complète avec corps et pièces jointes
  openmail attachment <ID> [--save fichier] [--stream]
  openmail contacts [requête]  ·  openmail templates  ·  openmail template <ID|nom>`,
    [`Writing and sending (draft IDs never change):
  openmail draft --to a@b.com [--cc ..] [--bcc ..] --subject "…" --body "markdown…"
             [--reply-to ID [--reply-all]] [--forward ID] [--account account] [--attach file]
             [--template name --placeholder "Field=value"] [--no-signature] [--edit ID]
  openmail draft --delete ID
  openmail drafts  ·  openmail scheduled
  openmail send <ID> [--at "tomorrow 9:00"] [--remind "in 3 days"]   sends and waits for SMTP confirmation
  openmail unschedule <ID>                       cancels a scheduled send (back to drafts)`]: `Rédaction et envoi (les ID de brouillons ne changent jamais) :
  openmail draft --to a@b.fr [--cc ..] [--bcc ..] --subject "…" --body "markdown…"
             [--reply-to ID [--reply-all]] [--forward ID] [--account compte] [--attach fichier]
             [--template nom --placeholder "Champ=valeur"] [--no-signature] [--edit ID]
  openmail draft --delete ID
  openmail drafts  ·  openmail scheduled
  openmail send <ID> [--at "tomorrow 9:00"] [--remind "in 3 days"]   envoie et attend la confirmation SMTP
  openmail unschedule <ID>                       annule un envoi programmé (retour aux brouillons)`,
    [`Organizing (message ID or t<thread ID>, several allowed):
  openmail action archive|inbox|trash|delete-forever|spam|not-spam|read|unread|pin|unpin|
              mute|unmute|aside|unaside|priority|unpriority|unsubscribe <ID...>
  openmail action snooze <ID...> --until "mon 8:00"   ·  openmail action unsnooze <ID...>
  openmail action remind <ID...> --at "in 3 days" [--if-no-reply]  ·  openmail action unremind <ID...>
  openmail action move <ID...> --folder "account@x.com:Folder"  ·  openmail action label|unlabel <ID...> --label X
  openmail sender accept|block|unblock|vip|unvip <email|@domain...>
  openmail sender category <email...> people|notification|newsletter`]: `Organisation (ID de message ou t<ID de conversation>, plusieurs possibles) :
  openmail action archive|inbox|trash|delete-forever|spam|not-spam|read|unread|pin|unpin|
              mute|unmute|aside|unaside|priority|unpriority|unsubscribe <ID...>
  openmail action snooze <ID...> --until "mon 8:00"   ·  openmail action unsnooze <ID...>
  openmail action remind <ID...> --at "in 3 days" [--if-no-reply]  ·  openmail action unremind <ID...>
  openmail action move <ID...> --folder "compte@x.fr:Dossier"  ·  openmail action label|unlabel <ID...> --label X
  openmail sender accept|block|unblock|vip|unvip <email|@domaine...>
  openmail sender category <email...> people|notification|newsletter`,
    [`Calendar:
  openmail events [--from "today"] [--to "in 7 days"]  ·  openmail availability [--days 5] [--duration 30]
  openmail event create --title "…" --start "tomorrow 10:00" [--end "tomorrow 11:00"] [--attendee a@b.com] [--location …]
  openmail event delete <ID>  ·  openmail invite <message ID>  ·  openmail rsvp <message ID> accept|maybe|decline`]: `Calendrier :
  openmail events [--from "today"] [--to "in 7 days"]  ·  openmail availability [--days 5] [--duration 30]
  openmail event create --title "…" --start "tomorrow 10:00" [--end "tomorrow 11:00"] [--attendee a@b.fr] [--location …]
  openmail event delete <ID>  ·  openmail invite <ID du message>  ·  openmail rsvp <ID du message> accept|maybe|decline`,
    [`AI (Ollama or Claude, per settings):
  openmail ai summarize <ID|tID>  ·  openmail ai reply <ID|tID> [--instructions "…"]  ·  openmail ai ask "question"`]: `IA (Ollama ou Claude, selon les paramètres) :
  openmail ai summarize <ID|tID>  ·  openmail ai reply <ID|tID> [--instructions "…"]  ·  openmail ai ask "question"`,
    [`Other:
  openmail status · openmail sync [account] · openmail history [--limit N] · openmail daemon (sync without a window)
  openmail serve [--port 8787]   home server (e.g. Raspberry Pi): 24/7 engine + API + web interface
  openmail server pair | devices | revoke <ID>    pairing codes and paired devices
  openmail server account | reset-password | reset-account --yes | 2fa-off | sign-out-all | pairing on|off
                                              the account of the home server (recovery on the NAS)
  openmail mcp   (MCP server on stdio for Claude Code / Claude Desktop)
Global: --json (machine-readable data), --no-sync (don't fetch new mail first)`]: `Autres :
  openmail status · openmail sync [compte] · openmail history [--limit N] · openmail daemon (synchronisation sans fenêtre)
  openmail serve [--port 8787]   serveur domestique (par ex. Raspberry Pi) : moteur 24h/24 + API + interface web
  openmail server pair | devices | revoke <ID>    codes de jumelage et appareils jumelés
  openmail server account | reset-password | reset-account --yes | 2fa-off | sign-out-all | pairing on|off
                                              le compte du serveur domestique (dépannage sur le NAS)
  openmail mcp   (serveur MCP sur stdio pour Claude Code / Claude Desktop)
Global : --json (données lisibles par machine), --no-sync (ne pas récupérer d’abord le nouveau courrier)`,

    // ── errors and messages ──
    'Could not understand the date for {label}: "{input}". Examples: "tomorrow 9:00", "fri 14:30", "in 2 hours", "2026-10-20 09:15".':
      'Date non comprise pour {label} : « {input} ». Exemples : "tomorrow 9:00", "fri 14:30", "in 2 hours", "2026-10-20 09:15".',
    'No message with ID {id} (give threads as t<ID>)': 'Aucun message avec l’ID {id} (indiquez les conversations sous la forme t<ID>)',
    'Invalid ID: {id}': 'ID invalide : {id}',
    'Give a message ID or a thread ID (t<ID>)': 'Indiquez un ID de message ou de conversation (t<ID>)',
    'No account {email}': 'Aucun compte {email}',
    'Account {email} has no folder "{folder}" (see: openmail folders {email})': 'Le compte {email} n’a pas de dossier « {folder} » (voir : openmail folders {email})',
    'Unknown mailbox "{name}". Use: Inbox, Sent, Archive, Trash, Spam, pinned, snoozed, aside, reminders, newsenders, account@x.com or account@x.com:Folder':
      'Boîte inconnue « {name} ». Utilisez : Inbox, Sent, Archive, Trash, Spam, pinned, snoozed, aside, reminders, newsenders, compte@x.fr ou compte@x.fr:Dossier',
    'The app is not running — fetching new mail…': 'L’application n’est pas lancée — récupération du nouveau courrier…',
    'Error: {message}': 'Erreur : {message}',
    'Unknown command "{cmd}". See: openmail help': 'Commande inconnue « {cmd} ». Voir : openmail help',

    // ── thread list (emails, search) ──
    Me: 'Moi',
    person: 'personne',
    'notif.': 'notif.',
    THREAD: 'CONVERSATION',
    DATE: 'DATE',
    FROM: 'DE',
    SUBJECT: 'OBJET',
    'CAT.': 'CAT.',
    FLAGS: 'INDICATEURS',
    ACCOUNT: 'COMPTE',
    'New senders awaiting a decision: {n} (openmail emails newsenders)': 'Nouveaux expéditeurs en attente de décision : {n} (openmail emails newsenders)',
    'Page {page}. Flags: U unread, P pinned, ! priority, A attachment, S snoozed, R reminder, N new sender, D draft, M muted, B set aside':
      'Page {page}. Indicateurs : U non lu, P épinglé, ! prioritaire, A pièce jointe, S reporté, R rappel, N nouvel expéditeur, D brouillon, M en sourdine, B mis de côté',
    'Give a topic or --filter': 'Indiquez un sujet ou --filter',
    'ID: {id} (thread t{thread}) · {date} · {account} · {folder}\nFrom: {from}\nSubject: {subject}':
      'ID : {id} (conversation t{thread}) · {date} · {account} · {folder}\nDe : {from}\nObjet : {subject}',
    'Nothing found.': 'Aucun résultat.',
    'Threads found: {total} (page {page})': 'Conversations trouvées : {total} (page {page})',

    // ── thread ──
    'Give a message ID or t<thread ID>': 'Indiquez un ID de message ou t<ID de conversation>',
    'Thread does not exist': 'La conversation n’existe pas',
    'Warning: not all message bodies were downloaded ({error})': 'Attention : tous les corps de message n’ont pas été téléchargés ({error})',
    'Thread t{id}: {subject}': 'Conversation t{id} : {subject}',
    'Account: {account} · messages: {n} · category: {category}': 'Compte : {account} · messages : {n} · catégorie : {category}',
    pinned: 'épinglé',
    'snoozed until {time}': 'reporté jusqu’à {time}',
    'reminder {time}': 'rappel {time}',
    'labels: {labels}': 'libellés : {labels}',
    UNREAD: 'NON LU',
    'From: {from}': 'De : {from}',
    'To: {to}': 'À : {to}',
    'Cc: {cc}': 'Cc : {cc}',
    'Bcc: {bcc}': 'Cci : {bcc}',
    'Subject: {subject}': 'Objet : {subject}',
    '📅 Contains an invitation (openmail invite {id})': '📅 Contient une invitation (openmail invite {id})',
    '(no content)': '(aucun contenu)',
    'Attachments:': 'Pièces jointes :',
    '(not downloaded — openmail attachment {id})': '(non téléchargée — openmail attachment {id})',
    NAME: 'NOM',
    SIZE: 'TAILLE',
    TYPE: 'TYPE',
    PATH: 'CHEMIN',
    'DRAFT ID: {id} · {status}': 'ID DU BROUILLON : {id} · {status}',
    'send at {time}': 'envoi {time}',

    // ── attachment ──
    'Give an attachment ID (the ID column in openmail thread)': 'Indiquez un ID de pièce jointe (colonne ID dans openmail thread)',
    'ID: {id}\nName: {name}\nSize: {size}\nType: {type}\nPath: {path}\nMessage: {message}':
      'ID : {id}\nNom : {name}\nTaille : {size}\nType : {type}\nChemin : {path}\nMessage : {message}',

    // ── accounts, folders, contacts, templates ──
    'no access': 'aucun',
    read: 'lecture',
    triage: 'tri',
    send: 'envoi',
    'AGENT ACCESS': 'ACCÈS DES AGENTS',
    SYNC: 'SYNCHRO',
    ERROR: 'ERREUR',
    'FOLDER (identifier)': 'DOSSIER (identifiant)',
    ROLE: 'RÔLE',
    TOTAL: 'TOTAL',
    'UNREAD THREADS': 'CONV. NON LUES',
    EMAIL: 'E-MAIL',
    CATEGORY: 'CATÉGORIE',
    SENT: 'ENVOYÉS',
    RECEIVED: 'REÇUS',
    LAST: 'DERNIER',
    FIELDS: 'CHAMPS',
    MODIFIED: 'MODIFIÉ',
    'ID: {id}\nName: {name}\nSubject: {subject}\nTo: {to}': 'ID : {id}\nNom : {name}\nObjet : {subject}\nÀ : {to}',
    'Fields:': 'Champs :',
    '(none)': '(aucun)',

    // ── drafts, sending ──
    TO: 'À',
    UPDATED: 'MODIFIÉ',
    'SEND AT': 'ENVOI',
    'Cancel: openmail unschedule <ID>': 'Annulation : openmail unschedule <ID>',
    'Draft {id} deleted.': 'Brouillon {id} supprimé.',
    'File not found: {path}': 'Fichier introuvable : {path}',
    'File {path} is larger than 25 MB': 'Le fichier {path} dépasse 25 Mo',
    file: 'fichier',
    'Status: draft (the ID will not change)': 'Statut : brouillon (l’ID ne changera pas)',
    'Attachments: {list}': 'Pièces jointes : {list}',
    'Send: openmail send {id}  ·  Open: openmail://draft/{id}': 'Envoi : openmail send {id}  ·  Ouvrir : openmail://draft/{id}',
    'Give a draft ID': 'Indiquez un ID de brouillon',
    'Warning: the app is not running — the message will go out only when you start OpenMail or `openmail daemon`.':
      'Attention : l’application n’est pas lancée — le message ne partira que lorsque vous démarrerez OpenMail ou `openmail daemon`.',
    'Scheduled: {subject}\nSend at: {time}\nCancel: openmail unschedule {id}': 'Programmé : {subject}\nEnvoi : {time}\nAnnulation : openmail unschedule {id}',
    'Sent: {subject} ({time})': 'Envoyé : {subject} ({time})',
    'Not sent (status: {status}): {error}': 'Non envoyé (statut : {status}) : {error}',
    'Not sent (status: {status})': 'Non envoyé (statut : {status})',
    'Send cancelled. "{subject}" is a draft again (ID {id}).': 'Envoi annulé. « {subject} » est de nouveau un brouillon (ID {id}).',

    // ── actions, senders ──
    'Give an action (openmail help)': 'Indiquez une action (openmail help)',
    '--folder must point to an account folder, e.g. account@x.com:Projects': '--folder doit désigner un dossier du compte, par ex. compte@x.fr:Projets',
    'Give --label': 'Indiquez --label',
    'Unknown action "{action}"': 'Action inconnue « {action} »',
    'Action partly failed: {errors}': 'Action partiellement échouée : {errors}',
    'OK: {result} (threads: {threads})': 'OK : {result} (conversations : {threads})',
    'Category: people|notification|newsletter': 'Catégorie : people|notification|newsletter',
    'Give address(es) or @domain': 'Indiquez une ou plusieurs adresses ou @domaine',

    // ── calendar, AI ──
    '{date} (all day)': '{date} (toute la journée)',
    START: 'DÉBUT',
    END: 'FIN',
    EVENT: 'ÉVÉNEMENT',
    CALENDAR: 'CALENDRIER',
    'MY RSVP': 'MA RÉPONSE',
    MEETING: 'RÉUNION',
    'No free slots in this range.': 'Aucun créneau libre dans cette plage.',
    'Give --title and --start': 'Indiquez --title et --start',
    'Created event {id}: {title} · {time}': 'Événement {id} créé : {title} · {time}',
    'Event deleted.': 'Événement supprimé.',
    'This message does not contain an invitation.': 'Ce message ne contient pas d’invitation.',
    'openmail rsvp <message ID> accept|maybe|decline': 'openmail rsvp <ID du message> accept|maybe|decline',
    'Invitation response sent.': 'Réponse à l’invitation envoyée.',
    'Sources: {list}': 'Sources : {list}',

    // ── status, sync, daemon, history ──
    'Sync engine: running ({owner}, pid {pid})': 'Moteur de synchronisation : actif ({owner}, pid {pid})',
    'Sync engine: NOT running — start the app or `openmail daemon`': 'Moteur de synchronisation : INACTIF — lancez l’application ou `openmail daemon`',
    '{email}: last sync {time} — ERROR: {error}': '{email} : dernière synchronisation {time} — ERREUR : {error}',
    '{email}: last sync {time}': '{email} : dernière synchronisation {time}',
    'Queued operations: {n}': 'Opérations en file d’attente : {n}',
    'Syncing {email}…': 'Synchronisation de {email}…',
    'Done.': 'Terminé.',
    'Sync is already running (the app or another daemon).': 'La synchronisation est déjà en cours (l’application ou un autre daemon).',
    'OpenMail daemon is running (Ctrl+C to stop).': 'Le daemon OpenMail est actif (Ctrl+C pour arrêter).',
    WHEN: 'QUAND',
    WHO: 'QUI',
    ACTION: 'ACTION',
    TARGET: 'CIBLE',
    RESULT: 'RÉSULTAT',
    DETAILS: 'DÉTAILS',

    // ── home server (openmail serve / openmail server) ──
    'A sync engine is already running on this computer (the app or a daemon). Close it before starting the server.':
      'Un moteur de synchronisation tourne déjà sur cet ordinateur (l’application ou un daemon). Fermez-le avant de démarrer le serveur.',
    [`OpenMail — home server is running.

Address:  {addresses}

Sign in with your email and password (and your authenticator code).
Forgot it? openmail server reset-password · Account: openmail server account · Ctrl+C to stop.`]: `OpenMail — le serveur domestique est actif.

Adresse :  {addresses}

Connectez-vous avec votre e-mail et votre mot de passe (et le code de votre application d’authentification).
Mot de passe oublié ? openmail server reset-password · Compte : openmail server account · Ctrl+C pour arrêter.`,
    [`OpenMail — home server is running.

Address:  {addresses}
Setup code: {code}

Open the address in a browser (or in the OpenMail app) and create your account with this code: email + password, then turn on two-step verification in Settings → Home server.
Choose the code yourself with OPENMAIL_SETUP_CODE. Device list: openmail server devices · Ctrl+C to stop.`]: `OpenMail — le serveur domestique est actif.

Adresse :  {addresses}
Code d’installation : {code}

Ouvrez l’adresse dans un navigateur (ou dans l’application OpenMail) et créez votre compte avec ce code : e-mail + mot de passe, puis activez la vérification en deux étapes dans Paramètres → Serveur domestique.
Vous pouvez choisir le code vous-même avec OPENMAIL_SETUP_CODE. Liste des appareils : openmail server devices · Ctrl+C pour arrêter.`,
    'Pairing code: {code}\nValid until: {time} (single use)': 'Code de jumelage : {code}\nValable jusqu’à : {time} (usage unique)',
    DEVICE: 'APPAREIL',
    PAIRED: 'JUMELÉ',
    'LAST SEEN': 'VU',
    'Give a device ID (openmail server devices)': 'Indiquez un ID d’appareil (openmail server devices)',
    'Access revoked.': 'Accès révoqué.',
    'No such device.': 'Aucun appareil de ce type.',
    'Account: {email}\nTwo-step verification: {state}\nRecovery codes left: {n}\nPairing codes: {pairing}': 'Compte : {email}\nVérification en deux étapes : {state}\nCodes de secours restants : {n}\nCodes de jumelage : {pairing}',
    'allowed': 'autorisés',
    'off': 'désactivée',
    'on': 'activée',
    'switched off': 'désactivés',
    'No account yet. Open the server address in a browser and create it with a pairing code (openmail server pair).': 'Aucun compte pour l’instant. Ouvrez l’adresse du serveur dans un navigateur et créez-le avec un code de jumelage (openmail server pair).',
    'Pairing codes are allowed.': 'Les codes de jumelage sont autorisés.',
    'Pairing codes are switched off.': 'Les codes de jumelage sont désactivés.',
    'Two-step verification is off. Turn it on again in Settings → Home server.': 'La vérification en deux étapes est désactivée. Réactivez-la dans Paramètres → Serveur domestique.',
    '{n} devices signed out.': '{n} appareils déconnectés.',
    'New password: ': 'Nouveau mot de passe : ',
    'Repeat the password: ': 'Répétez le mot de passe : ',
    'Password changed for {email}. The account is unlocked.': 'Mot de passe modifié pour {email}. Le compte est déverrouillé.',
    'Account deleted. Open the server address in a browser and create a new one with this pairing code (valid 15 min): {code}': 'Compte supprimé. Ouvrez l’adresse du serveur dans un navigateur et créez-en un nouveau avec ce code de jumelage (valable 15 min) : {code}',
    'This deletes the account {email} and signs every device out. Mail accounts and messages are kept. Run again with --yes to confirm.': 'Cela supprime le compte {email} et déconnecte tous les appareils. Les comptes mail et les messages sont conservés. Relancez avec --yes pour confirmer.',
    'The account already exists: sign in with its email and password.': 'Le compte existe déjà : connectez-vous avec son e-mail et son mot de passe.',
    'Setup code: {code}': 'Code d’installation : {code}',
  },
  plurals: {},
}
export default dict
