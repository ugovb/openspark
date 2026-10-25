// Spanish translations: cli. Keys are the English source strings used with t() / tp().
import type { Dictionary } from '../../i18n'

const dict: Dictionary = {
  strings: {
    // the same in Spanish
    'newsl.': 'newsl.',
    // ── help (openmail help) ──
    'openmail {version} — OpenMail from the command line (local times with UTC offset)':
      'openmail {version} — OpenMail desde la línea de comandos (horas locales con desfase UTC)',
    [`Reading:
  openmail accounts                              accounts, agent access levels
  openmail folders [account]                     folders with counts
  openmail emails [mailbox] [--filter q] [--page N] [--page-size N] [--unread]
       mailbox: Inbox|Sent|Archive|Trash|Spam|pinned|snoozed|aside|reminders|newsenders|
                people|notifications|newsletters|account@x.com|account@x.com:Folder|<smart folder>
  openmail search ["topic"] [--filter q] [--in account|account:Folder] [--page N]   (all folders)
  openmail thread <ID|tID> [--html]              whole thread with bodies and attachments
  openmail attachment <ID> [--save file] [--stream]
  openmail contacts [query]  ·  openmail templates  ·  openmail template <ID|name>`]: `Lectura:
  openmail accounts                              cuentas, niveles de acceso de agentes
  openmail folders [cuenta]                      carpetas con contadores
  openmail emails [buzón] [--filter q] [--page N] [--page-size N] [--unread]
       buzón: Inbox|Sent|Archive|Trash|Spam|pinned|snoozed|aside|reminders|newsenders|
              people|notifications|newsletters|cuenta@x.com|cuenta@x.com:Carpeta|<carpeta inteligente>
  openmail search ["tema"] [--filter q] [--in cuenta|cuenta:Carpeta] [--page N]   (todas las carpetas)
  openmail thread <ID|tID> [--html]              hilo completo con contenido y adjuntos
  openmail attachment <ID> [--save archivo] [--stream]
  openmail contacts [texto]  ·  openmail templates  ·  openmail template <ID|nombre>`,
    [`Writing and sending (draft IDs never change):
  openmail draft --to a@b.com [--cc ..] [--bcc ..] --subject "…" --body "markdown…"
             [--reply-to ID [--reply-all]] [--forward ID] [--account account] [--attach file]
             [--template name --placeholder "Field=value"] [--no-signature] [--edit ID]
  openmail draft --delete ID
  openmail drafts  ·  openmail scheduled
  openmail send <ID> [--at "tomorrow 9:00"] [--remind "in 3 days"]   sends and waits for SMTP confirmation
  openmail unschedule <ID>                       cancels a scheduled send (back to drafts)`]: `Redacción y envío (los ID de borradores no cambian):
  openmail draft --to a@b.com [--cc ..] [--bcc ..] --subject "…" --body "markdown…"
             [--reply-to ID [--reply-all]] [--forward ID] [--account cuenta] [--attach archivo]
             [--template nombre --placeholder "Campo=valor"] [--no-signature] [--edit ID]
  openmail draft --delete ID
  openmail drafts  ·  openmail scheduled
  openmail send <ID> [--at "mañana 9:00"] [--remind "en 3 días"]   envía y espera la confirmación SMTP
  openmail unschedule <ID>                       cancela un envío programado (vuelve a borradores)`,
    [`Organizing (message ID or t<thread ID>, several allowed):
  openmail action archive|inbox|trash|delete-forever|spam|not-spam|read|unread|pin|unpin|
              mute|unmute|aside|unaside|priority|unpriority|unsubscribe <ID...>
  openmail action snooze <ID...> --until "mon 8:00"   ·  openmail action unsnooze <ID...>
  openmail action remind <ID...> --at "in 3 days" [--if-no-reply]  ·  openmail action unremind <ID...>
  openmail action move <ID...> --folder "account@x.com:Folder"  ·  openmail action label|unlabel <ID...> --label X
  openmail sender accept|block|unblock|vip|unvip <email|@domain...>
  openmail sender category <email...> people|notification|newsletter`]: `Organización (ID de mensaje o t<ID de hilo>, se admiten varios):
  openmail action archive|inbox|trash|delete-forever|spam|not-spam|read|unread|pin|unpin|
              mute|unmute|aside|unaside|priority|unpriority|unsubscribe <ID...>
  openmail action snooze <ID...> --until "lun 8:00"   ·  openmail action unsnooze <ID...>
  openmail action remind <ID...> --at "en 3 días" [--if-no-reply]  ·  openmail action unremind <ID...>
  openmail action move <ID...> --folder "cuenta@x.com:Carpeta"  ·  openmail action label|unlabel <ID...> --label X
  openmail sender accept|block|unblock|vip|unvip <email|@dominio...>
  openmail sender category <email...> people|notification|newsletter`,
    [`Calendar:
  openmail events [--from "today"] [--to "in 7 days"]  ·  openmail availability [--days 5] [--duration 30]
  openmail event create --title "…" --start "tomorrow 10:00" [--end "tomorrow 11:00"] [--attendee a@b.com] [--location …]
  openmail event delete <ID>  ·  openmail invite <message ID>  ·  openmail rsvp <message ID> accept|maybe|decline`]: `Calendario:
  openmail events [--from "hoy"] [--to "en 7 días"]  ·  openmail availability [--days 5] [--duration 30]
  openmail event create --title "…" --start "mañana 10:00" [--end "mañana 11:00"] [--attendee a@b.com] [--location …]
  openmail event delete <ID>  ·  openmail invite <ID de mensaje>  ·  openmail rsvp <ID de mensaje> accept|maybe|decline`,
    [`AI (Ollama or Claude, per settings):
  openmail ai summarize <ID|tID>  ·  openmail ai reply <ID|tID> [--instructions "…"]  ·  openmail ai ask "question"`]: `IA (Ollama o Claude, según los ajustes):
  openmail ai summarize <ID|tID>  ·  openmail ai reply <ID|tID> [--instructions "…"]  ·  openmail ai ask "pregunta"`,
    [`Other:
  openmail status · openmail sync [account] · openmail history [--limit N] · openmail daemon (sync without a window)
  openmail serve [--port 8787]   home server (e.g. Raspberry Pi): 24/7 engine + API + web interface
  openmail server pair | devices | revoke <ID>    pairing codes and paired devices
  openmail server account | reset-password | reset-account --yes | 2fa-off | sign-out-all | pairing on|off
                                              the account of the home server (recovery on the NAS)
  openmail mcp   (MCP server on stdio for Claude Code / Claude Desktop)
Global: --json (machine-readable data), --no-sync (don't fetch new mail first)`]: `Otros:
  openmail status · openmail sync [cuenta] · openmail history [--limit N] · openmail daemon (sincronización sin ventana)
  openmail serve [--port 8787]   servidor doméstico (p. ej. Raspberry Pi): motor 24/7 + API + interfaz web
  openmail server pair | devices | revoke <ID>    códigos de emparejamiento y dispositivos emparejados
  openmail server account | reset-password | reset-account --yes | 2fa-off | sign-out-all | pairing on|off
                                              la cuenta del servidor doméstico (recuperación en el NAS)
  openmail mcp   (servidor MCP por stdio para Claude Code / Claude Desktop)
Globales: --json (datos legibles por máquina), --no-sync (sin descargar antes el correo nuevo)`,

    // ── errors and messages ──
    'Could not understand the date for {label}: "{input}". Examples: "tomorrow 9:00", "fri 14:30", "in 2 hours", "2026-10-20 09:15".':
      'No entiendo la fecha de {label}: «{input}». Ejemplos: "mañana 9:00", "vie 14:30", "en 2 horas", "2026-10-20 09:15".',
    'No message with ID {id} (give threads as t<ID>)': 'No existe un mensaje con ID {id} (indica los hilos como t<ID>)',
    'Invalid ID: {id}': 'ID no válido: {id}',
    'Give a message ID or a thread ID (t<ID>)': 'Indica un ID de mensaje o de hilo (t<ID>)',
    'No account {email}': 'No existe la cuenta {email}',
    'Account {email} has no folder "{folder}" (see: openmail folders {email})': 'La cuenta {email} no tiene la carpeta «{folder}» (consulta: openmail folders {email})',
    'Unknown mailbox "{name}". Use: Inbox, Sent, Archive, Trash, Spam, pinned, snoozed, aside, reminders, newsenders, account@x.com or account@x.com:Folder':
      'Buzón desconocido «{name}». Usa: Inbox, Sent, Archive, Trash, Spam, pinned, snoozed, aside, reminders, newsenders, cuenta@x.com o cuenta@x.com:Carpeta',
    'The app is not running — fetching new mail…': 'La aplicación no está en ejecución — descargando correo nuevo…',
    'Error: {message}': 'Error: {message}',
    'Unknown command "{cmd}". See: openmail help': 'Comando desconocido «{cmd}». Consulta: openmail help',

    // ── thread list (emails, search) ──
    Me: 'Yo',
    person: 'persona',
    'notif.': 'notif.',
    THREAD: 'HILO',
    DATE: 'FECHA',
    FROM: 'DE',
    SUBJECT: 'ASUNTO',
    'CAT.': 'CAT.',
    FLAGS: 'MARCAS',
    ACCOUNT: 'CUENTA',
    'New senders awaiting a decision: {n} (openmail emails newsenders)': 'Remitentes nuevos pendientes de decisión: {n} (openmail emails newsenders)',
    'Page {page}. Flags: U unread, P pinned, ! priority, A attachment, S snoozed, R reminder, N new sender, D draft, M muted, B set aside':
      'Página {page}. Marcas: U no leído, P fijado, ! prioridad, A adjunto, S pospuesto, R recordatorio, N remitente nuevo, D borrador, M silenciado, B apartado',
    'Give a topic or --filter': 'Indica un tema o --filter',
    'ID: {id} (thread t{thread}) · {date} · {account} · {folder}\nFrom: {from}\nSubject: {subject}':
      'ID: {id} (hilo t{thread}) · {date} · {account} · {folder}\nDe: {from}\nAsunto: {subject}',
    'Nothing found.': 'No se encontró nada.',
    'Threads found: {total} (page {page})': 'Hilos encontrados: {total} (página {page})',

    // ── thread ──
    'Give a message ID or t<thread ID>': 'Indica un ID de mensaje o t<ID de hilo>',
    'Thread does not exist': 'El hilo no existe',
    'Warning: not all message bodies were downloaded ({error})': 'Aviso: no se descargó el contenido de todos los mensajes ({error})',
    'Thread t{id}: {subject}': 'Hilo t{id}: {subject}',
    'Account: {account} · messages: {n} · category: {category}': 'Cuenta: {account} · mensajes: {n} · categoría: {category}',
    pinned: 'fijado',
    'snoozed until {time}': 'pospuesto hasta {time}',
    'reminder {time}': 'recordatorio {time}',
    'labels: {labels}': 'etiquetas: {labels}',
    UNREAD: 'NO LEÍDO',
    'From: {from}': 'De: {from}',
    'To: {to}': 'Para: {to}',
    'Cc: {cc}': 'Cc: {cc}',
    'Bcc: {bcc}': 'Cco: {bcc}',
    'Subject: {subject}': 'Asunto: {subject}',
    '📅 Contains an invitation (openmail invite {id})': '📅 Contiene una invitación (openmail invite {id})',
    '(no content)': '(sin contenido)',
    'Attachments:': 'Adjuntos:',
    '(not downloaded — openmail attachment {id})': '(no descargado — openmail attachment {id})',
    NAME: 'NOMBRE',
    SIZE: 'TAMAÑO',
    TYPE: 'TIPO',
    PATH: 'RUTA',
    'DRAFT ID: {id} · {status}': 'ID DE BORRADOR: {id} · {status}',
    'send at {time}': 'envío {time}',

    // ── attachment ──
    'Give an attachment ID (the ID column in openmail thread)': 'Indica un ID de adjunto (la columna ID de openmail thread)',
    'ID: {id}\nName: {name}\nSize: {size}\nType: {type}\nPath: {path}\nMessage: {message}':
      'ID: {id}\nNombre: {name}\nTamaño: {size}\nTipo: {type}\nRuta: {path}\nMensaje: {message}',

    // ── accounts, folders, contacts, templates ──
    'no access': 'sin acceso',
    read: 'lectura',
    triage: 'organización',
    send: 'envío',
    'AGENT ACCESS': 'ACCESO DE AGENTES',
    SYNC: 'SINCRONIZACIÓN',
    ERROR: 'ERROR',
    'FOLDER (identifier)': 'CARPETA (identificador)',
    ROLE: 'FUNCIÓN',
    TOTAL: 'TOTAL',
    'UNREAD THREADS': 'HILOS NO LEÍDOS',
    EMAIL: 'CORREO',
    CATEGORY: 'CATEGORÍA',
    SENT: 'ENVIADOS',
    RECEIVED: 'RECIBIDOS',
    LAST: 'ÚLTIMO',
    FIELDS: 'CAMPOS',
    MODIFIED: 'MODIFICADO',
    'ID: {id}\nName: {name}\nSubject: {subject}\nTo: {to}': 'ID: {id}\nNombre: {name}\nAsunto: {subject}\nPara: {to}',
    'Fields:': 'Campos:',
    '(none)': '(ninguno)',

    // ── drafts, sending ──
    TO: 'PARA',
    UPDATED: 'ACTUALIZADO',
    'SEND AT': 'ENVÍO',
    'Cancel: openmail unschedule <ID>': 'Cancelar: openmail unschedule <ID>',
    'Draft {id} deleted.': 'Borrador {id} eliminado.',
    'File not found: {path}': 'No se encontró el archivo: {path}',
    'File {path} is larger than 25 MB': 'El archivo {path} pesa más de 25 MB',
    file: 'archivo',
    'Status: draft (the ID will not change)': 'Estado: borrador (el ID no cambiará)',
    'Attachments: {list}': 'Adjuntos: {list}',
    'Send: openmail send {id}  ·  Open: openmail://draft/{id}': 'Enviar: openmail send {id}  ·  Abrir: openmail://draft/{id}',
    'Give a draft ID': 'Indica un ID de borrador',
    'Warning: the app is not running — the message will go out only when you start OpenMail or `openmail daemon`.':
      'Aviso: la aplicación no está en ejecución — el mensaje saldrá solo cuando inicies OpenMail o `openmail daemon`.',
    'Scheduled: {subject}\nSend at: {time}\nCancel: openmail unschedule {id}': 'Programado: {subject}\nEnvío: {time}\nCancelar: openmail unschedule {id}',
    'Sent: {subject} ({time})': 'Enviado: {subject} ({time})',
    'Not sent (status: {status}): {error}': 'No enviado (estado: {status}): {error}',
    'Not sent (status: {status})': 'No enviado (estado: {status})',
    'Send cancelled. "{subject}" is a draft again (ID {id}).': 'Envío cancelado. «{subject}» vuelve a ser un borrador (ID {id}).',

    // ── actions, senders ──
    'Give an action (openmail help)': 'Indica una acción (openmail help)',
    '--folder must point to an account folder, e.g. account@x.com:Projects': '--folder debe apuntar a una carpeta de la cuenta, p. ej. cuenta@x.com:Proyectos',
    'Give --label': 'Indica --label',
    'Unknown action "{action}"': 'Acción desconocida «{action}»',
    'Action partly failed: {errors}': 'La acción falló en parte: {errors}',
    'OK: {result} (threads: {threads})': 'OK: {result} (hilos: {threads})',
    'Category: people|notification|newsletter': 'Categoría: people|notification|newsletter',
    'Give address(es) or @domain': 'Indica una o más direcciones o un @dominio',

    // ── calendar, AI ──
    '{date} (all day)': '{date} (todo el día)',
    START: 'INICIO',
    END: 'FIN',
    EVENT: 'EVENTO',
    CALENDAR: 'CALENDARIO',
    'MY RSVP': 'MI RESP.',
    MEETING: 'REUNIÓN',
    'No free slots in this range.': 'No hay horarios libres en este intervalo.',
    'Give --title and --start': 'Indica --title y --start',
    'Created event {id}: {title} · {time}': 'Evento creado {id}: {title} · {time}',
    'Event deleted.': 'Evento eliminado.',
    'This message does not contain an invitation.': 'Este mensaje no contiene ninguna invitación.',
    'openmail rsvp <message ID> accept|maybe|decline': 'openmail rsvp <ID de mensaje> accept|maybe|decline',
    'Invitation response sent.': 'Respuesta a la invitación enviada.',
    'Sources: {list}': 'Fuentes: {list}',

    // ── status, sync, daemon, history ──
    'Sync engine: running ({owner}, pid {pid})': 'Motor de sincronización: en ejecución ({owner}, pid {pid})',
    'Sync engine: NOT running — start the app or `openmail daemon`': 'Motor de sincronización: NO está en ejecución — inicia la aplicación o `openmail daemon`',
    '{email}: last sync {time} — ERROR: {error}': '{email}: última sincronización {time} — ERROR: {error}',
    '{email}: last sync {time}': '{email}: última sincronización {time}',
    'Queued operations: {n}': 'Operaciones en cola: {n}',
    'Syncing {email}…': 'Sincronizando {email}…',
    'Done.': 'Listo.',
    'Sync is already running (the app or another daemon).': 'La sincronización ya está en ejecución (la aplicación u otro daemon).',
    'OpenMail daemon is running (Ctrl+C to stop).': 'El daemon de OpenMail está en ejecución (Ctrl+C para detenerlo).',
    WHEN: 'CUÁNDO',
    WHO: 'QUIÉN',
    ACTION: 'ACCIÓN',
    TARGET: 'DESTINO',
    RESULT: 'RESULTADO',
    DETAILS: 'DETALLES',

    // ── home server (openmail serve / openmail server) ──
    'A sync engine is already running on this computer (the app or a daemon). Close it before starting the server.':
      'Ya hay un motor de sincronización en ejecución en este equipo (la aplicación o un daemon). Ciérralo antes de iniciar el servidor.',
    [`OpenMail — home server is running.

Address:  {addresses}

Sign in with your email and password (and your authenticator code).
Forgot it? openmail server reset-password · Account: openmail server account · Ctrl+C to stop.`]: `OpenMail — el servidor doméstico está en ejecución.

Dirección:  {addresses}

Inicia sesión con tu correo y tu contraseña (y el código de tu aplicación de autenticación).
¿La olvidaste? openmail server reset-password · Cuenta: openmail server account · Ctrl+C para detener.`,
    [`OpenMail — home server is running.

Address:  {addresses}
Pairing code (valid for 15 min): {code}

Open the address in a browser and create your account with this code (email + password, then turn on two-step verification in Settings → Home server).
The desktop app can also pair with it. New code: openmail server pair · Device list: openmail server devices · Ctrl+C to stop.`]: `OpenMail — el servidor doméstico está en ejecución.

Dirección:  {addresses}
Código de emparejamiento (válido 15 min): {code}

Abre la dirección en un navegador y crea tu cuenta con este código (correo + contraseña; después activa la verificación en dos pasos en Ajustes → Servidor doméstico).
La aplicación de escritorio también puede emparejarse. Código nuevo: openmail server pair · Lista de dispositivos: openmail server devices · Ctrl+C para detener.`,
    'Pairing code: {code}\nValid until: {time} (single use)': 'Código de emparejamiento: {code}\nVálido hasta: {time} (un solo uso)',
    DEVICE: 'DISPOSITIVO',
    PAIRED: 'EMPAREJADO',
    'LAST SEEN': 'ÚLTIMA VEZ',
    'Give a device ID (openmail server devices)': 'Indica un ID de dispositivo (openmail server devices)',
    'Access revoked.': 'Acceso revocado.',
    'No such device.': 'No existe ese dispositivo.',
    'Account: {email}\nTwo-step verification: {state}\nRecovery codes left: {n}\nPairing codes: {pairing}': 'Cuenta: {email}\nVerificación en dos pasos: {state}\nCódigos de recuperación restantes: {n}\nCódigos de emparejamiento: {pairing}',
    'allowed': 'permitidos',
    'off': 'desactivada',
    'on': 'activada',
    'switched off': 'desactivados',
    'No account yet. Open the server address in a browser and create it with a pairing code (openmail server pair).': 'Aún no hay cuenta. Abre la dirección del servidor en un navegador y créala con un código de emparejamiento (openmail server pair).',
    'Pairing codes are allowed.': 'Los códigos de emparejamiento están permitidos.',
    'Pairing codes are switched off.': 'Los códigos de emparejamiento están desactivados.',
    'Two-step verification is off. Turn it on again in Settings → Home server.': 'La verificación en dos pasos está desactivada. Vuelve a activarla en Ajustes → Servidor doméstico.',
    '{n} devices signed out.': '{n} dispositivos desconectados.',
    'New password: ': 'Nueva contraseña: ',
    'Repeat the password: ': 'Repite la contraseña: ',
    'Password changed for {email}. The account is unlocked.': 'Contraseña cambiada para {email}. La cuenta está desbloqueada.',
    'Account deleted. Open the server address in a browser and create a new one with this pairing code (valid 15 min): {code}': 'Cuenta eliminada. Abre la dirección del servidor en un navegador y crea una nueva con este código de emparejamiento (válido 15 min): {code}',
    'This deletes the account {email} and signs every device out. Mail accounts and messages are kept. Run again with --yes to confirm.': 'Esto elimina la cuenta {email} y cierra la sesión en todos los dispositivos. Las cuentas de correo y los mensajes se conservan. Vuelve a ejecutarlo con --yes para confirmar.',
  },
  plurals: {},
}
export default dict
