import { useEffect, useReducer } from 'react'

/**
 * Lightweight UI internationalization. Strings are keyed by their English text, so a
 * missing translation falls back to English automatically. `useT()` subscribes a
 * component to language changes so the whole UI re-renders when the language is
 * switched. Only the app's own chrome is translated — chat and model output stay in
 * whatever language they were written in.
 */

export type Lang = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ru' | 'ar' | 'zh' | 'ja' | 'hi'
type Target = Exclude<Lang, 'en'>

const dict: Record<string, Partial<Record<Target, string>>> = {
  // ---- sidebar ----
  'New session': { es: 'Nueva sesión', fr: 'Nouvelle session', de: 'Neue Sitzung', pt: 'Nova sessão', ru: 'Новая сессия', ar: 'جلسة جديدة', zh: '新会话', ja: '新しいセッション', hi: 'नया सत्र' },
  Search: { es: 'Buscar', fr: 'Rechercher', de: 'Suchen', pt: 'Pesquisar', ru: 'Поиск', ar: 'بحث', zh: '搜索', ja: '検索', hi: 'खोजें' },
  Automations: { es: 'Automatizaciones', fr: 'Automatisations', de: 'Automatisierungen', pt: 'Automações', ru: 'Автоматизации', ar: 'الأتمتة', zh: '自动化', ja: '自動化', hi: 'ऑटोमेशन' },
  Plugins: { es: 'Complementos', fr: 'Extensions', de: 'Plugins', pt: 'Plugins', ru: 'Плагины', ar: 'الإضافات', zh: '插件', ja: 'プラグイン', hi: 'प्लगइन' },
  Settings: { es: 'Ajustes', fr: 'Paramètres', de: 'Einstellungen', pt: 'Configurações', ru: 'Настройки', ar: 'الإعدادات', zh: '设置', ja: '設定', hi: 'सेटिंग्स' },
  Workspaces: { es: 'Espacios de trabajo', fr: 'Espaces de travail', de: 'Arbeitsbereiche', pt: 'Espaços de trabalho', ru: 'Рабочие пространства', ar: 'مساحات العمل', zh: '工作区', ja: 'ワークスペース', hi: 'वर्कस्पेस' },
  Recent: { es: 'Recientes', fr: 'Récents', de: 'Zuletzt', pt: 'Recentes', ru: 'Недавние', ar: 'الأخيرة', zh: '最近', ja: '最近', hi: 'हाल ही के' },
  Pinned: { es: 'Fijados', fr: 'Épinglés', de: 'Angeheftet', pt: 'Fixados', ru: 'Закреплённые', ar: 'المثبتة', zh: '已固定', ja: 'ピン留め', hi: 'पिन किए गए' },
  'Search sessions…': { es: 'Buscar sesiones…', fr: 'Rechercher des sessions…', de: 'Sitzungen suchen…', pt: 'Pesquisar sessões…', ru: 'Поиск сессий…', ar: 'بحث في الجلسات…', zh: '搜索会话…', ja: 'セッションを検索…', hi: 'सत्र खोजें…' },
  'No sessions yet.': { es: 'Aún no hay sesiones.', fr: 'Aucune session pour l’instant.', de: 'Noch keine Sitzungen.', pt: 'Ainda não há sessões.', ru: 'Пока нет сессий.', ar: 'لا توجد جلسات بعد.', zh: '还没有会话。', ja: 'まだセッションがありません。', hi: 'अभी कोई सत्र नहीं।' },

  // ---- settings nav ----
  General: { es: 'General', fr: 'Général', de: 'Allgemein', pt: 'Geral', ru: 'Общие', ar: 'عام', zh: '常规', ja: '一般', hi: 'सामान्य' },
  Models: { es: 'Modelos', fr: 'Modèles', de: 'Modelle', pt: 'Modelos', ru: 'Модели', ar: 'النماذج', zh: '模型', ja: 'モデル', hi: 'मॉडल' },
  Permissions: { es: 'Permisos', fr: 'Autorisations', de: 'Berechtigungen', pt: 'Permissões', ru: 'Разрешения', ar: 'الأذونات', zh: '权限', ja: '権限', hi: 'अनुमतियाँ' },
  Import: { es: 'Importar', fr: 'Importer', de: 'Importieren', pt: 'Importar', ru: 'Импорт', ar: 'استيراد', zh: '导入', ja: 'インポート', hi: 'आयात' },
  Developer: { es: 'Desarrollador', fr: 'Développeur', de: 'Entwickler', pt: 'Desenvolvedor', ru: 'Разработчик', ar: 'المطور', zh: '开发者', ja: '開発者', hi: 'डेवलपर' },
  Integrations: { es: 'Integraciones', fr: 'Intégrations', de: 'Integrationen', pt: 'Integrações', ru: 'Интеграции', ar: 'التكاملات', zh: '集成', ja: '連携', hi: 'एकीकरण' },
  About: { es: 'Acerca de', fr: 'À propos', de: 'Über', pt: 'Sobre', ru: 'О программе', ar: 'حول', zh: '关于', ja: '概要', hi: 'परिचय' },

  // ---- general pane ----
  Appearance: { es: 'Apariencia', fr: 'Apparence', de: 'Darstellung', pt: 'Aparência', ru: 'Внешний вид', ar: 'المظهر', zh: '外观', ja: '外観', hi: 'रूप' },
  Language: { es: 'Idioma', fr: 'Langue', de: 'Sprache', pt: 'Idioma', ru: 'Язык', ar: 'اللغة', zh: '语言', ja: '言語', hi: 'भाषा' },
  Theme: { es: 'Tema', fr: 'Thème', de: 'Design', pt: 'Tema', ru: 'Тема', ar: 'السمة', zh: '主题', ja: 'テーマ', hi: 'थीम' },
  Dark: { es: 'Oscuro', fr: 'Sombre', de: 'Dunkel', pt: 'Escuro', ru: 'Тёмная', ar: 'داكن', zh: '深色', ja: 'ダーク', hi: 'गहरा' },
  Light: { es: 'Claro', fr: 'Clair', de: 'Hell', pt: 'Claro', ru: 'Светлая', ar: 'فاتح', zh: '浅色', ja: 'ライト', hi: 'हल्का' },
  'Agent environment': { es: 'Entorno del agente', fr: 'Environnement de l’agent', de: 'Agent-Umgebung', pt: 'Ambiente do agente', ru: 'Среда агента', ar: 'بيئة الوكيل', zh: '代理环境', ja: 'エージェント環境', hi: 'एजेंट पर्यावरण' },
  'Where the agent runs': { es: 'Dónde se ejecuta el agente', fr: 'Où l’agent s’exécute', de: 'Wo der Agent läuft', pt: 'Onde o agente é executado', ru: 'Где работает агент', ar: 'أين يعمل الوكيل', zh: '代理运行位置', ja: 'エージェントの実行場所', hi: 'एजेंट कहाँ चलता है' },
  'Integrated terminal': { es: 'Terminal integrada', fr: 'Terminal intégré', de: 'Integriertes Terminal', pt: 'Terminal integrado', ru: 'Встроенный терминал', ar: 'الطرفية المدمجة', zh: '集成终端', ja: '統合ターミナル', hi: 'एकीकृत टर्मिनल' },
  'Terminal shell': { es: 'Shell de terminal', fr: 'Shell du terminal', de: 'Terminal-Shell', pt: 'Shell do terminal', ru: 'Оболочка терминала', ar: 'صدفة الطرفية', zh: '终端 Shell', ja: 'ターミナルシェル', hi: 'टर्मिनल शेल' },
  Saved: { es: 'Guardado', fr: 'Enregistré', de: 'Gespeichert', pt: 'Salvo', ru: 'Сохранено', ar: 'تم الحفظ', zh: '已保存', ja: '保存しました', hi: 'सहेजा गया' },
  'Windows native': { es: 'Windows nativo', fr: 'Windows natif', de: 'Windows nativ', pt: 'Windows nativo', ru: 'Нативная Windows', ar: 'ويندوز الأصلي', zh: '原生 Windows', ja: 'ネイティブ Windows', hi: 'विंडोज़ नेटिव' },
  'Interface language and text direction (RTL for Arabic).': { es: 'Idioma de la interfaz y dirección del texto (RTL para árabe).', fr: 'Langue de l’interface et sens du texte (RTL pour l’arabe).', de: 'Oberflächensprache und Textrichtung (RTL für Arabisch).', pt: 'Idioma da interface e direção do texto (RTL para árabe).', ru: 'Язык интерфейса и направление текста (RTL для арабского).', ar: 'لغة الواجهة واتجاه النص (من اليمين إلى اليسار للعربية).', zh: '界面语言和文字方向（阿拉伯语为从右到左）。', ja: 'インターフェースの言語とテキストの方向（アラビア語は右から左）。', hi: 'इंटरफ़ेस भाषा और टेक्स्ट दिशा (अरबी के लिए RTL)।' },
  'Light or dark appearance.': { es: 'Apariencia clara u oscura.', fr: 'Apparence claire ou sombre.', de: 'Helle oder dunkle Darstellung.', pt: 'Aparência clara ou escura.', ru: 'Светлое или тёмное оформление.', ar: 'مظهر فاتح أو داكن.', zh: '浅色或深色外观。', ja: 'ライトまたはダークの外観。', hi: 'हल्का या गहरा रूप।' },
  'Windows native, or inside WSL (Linux).': { es: 'Windows nativo, o dentro de WSL (Linux).', fr: 'Windows natif, ou dans WSL (Linux).', de: 'Windows nativ oder in WSL (Linux).', pt: 'Windows nativo, ou dentro do WSL (Linux).', ru: 'Нативная Windows или внутри WSL (Linux).', ar: 'ويندوز الأصلي، أو داخل WSL (لينكس).', zh: '原生 Windows，或在 WSL (Linux) 中。', ja: 'ネイティブ Windows、または WSL (Linux) 内。', hi: 'विंडोज़ नेटिव, या WSL (Linux) के अंदर।' },
  'Which shell the agent runs bash commands in.': { es: 'En qué shell el agente ejecuta comandos bash.', fr: 'Le shell dans lequel l’agent exécute les commandes bash.', de: 'In welcher Shell der Agent Bash-Befehle ausführt.', pt: 'Em qual shell o agente executa comandos bash.', ru: 'В какой оболочке агент выполняет bash-команды.', ar: 'الصدفة التي ينفّذ فيها الوكيل أوامر bash.', zh: '代理在其中运行 bash 命令的 Shell。', ja: 'エージェントが bash コマンドを実行するシェル。', hi: 'एजेंट किस शेल में bash कमांड चलाता है।' },

  // ---- permissions pane ----
  'Default permissions': { es: 'Permisos predeterminados', fr: 'Autorisations par défaut', de: 'Standardberechtigungen', pt: 'Permissões padrão', ru: 'Разрешения по умолчанию', ar: 'الأذونات الافتراضية', zh: '默认权限', ja: 'デフォルトの権限', hi: 'डिफ़ॉल्ट अनुमतियाँ' },
  'Full access': { es: 'Acceso total', fr: 'Accès complet', de: 'Vollzugriff', pt: 'Acesso total', ru: 'Полный доступ', ar: 'وصول كامل', zh: '完全访问', ja: 'フルアクセス', hi: 'पूर्ण पहुँच' },
  Autonomy: { es: 'Autonomía', fr: 'Autonomie', de: 'Autonomie', pt: 'Autonomia', ru: 'Автономность', ar: 'الاستقلالية', zh: '自主性', ja: '自律性', hi: 'स्वायत्तता' },
  'Max steps per task': { es: 'Máximo de pasos por tarea', fr: 'Étapes max. par tâche', de: 'Max. Schritte pro Aufgabe', pt: 'Máx. de passos por tarefa', ru: 'Макс. шагов на задачу', ar: 'أقصى عدد خطوات لكل مهمة', zh: '每个任务最大步数', ja: 'タスクあたりの最大ステップ数', hi: 'प्रति कार्य अधिकतम चरण' },

  // ---- token activity ----
  'Token activity': { es: 'Actividad de tokens', fr: 'Activité des tokens', de: 'Token-Aktivität', pt: 'Atividade de tokens', ru: 'Активность токенов', ar: 'نشاط الرموز', zh: 'Token 活动', ja: 'トークンのアクティビティ', hi: 'टोकन गतिविधि' },
  Daily: { es: 'Diario', fr: 'Quotidien', de: 'Täglich', pt: 'Diário', ru: 'По дням', ar: 'يومي', zh: '每日', ja: '日次', hi: 'दैनिक' },
  Weekly: { es: 'Semanal', fr: 'Hebdomadaire', de: 'Wöchentlich', pt: 'Semanal', ru: 'По неделям', ar: 'أسبوعي', zh: '每周', ja: '週次', hi: 'साप्ताहिक' },
  Cumulative: { es: 'Acumulado', fr: 'Cumulé', de: 'Kumuliert', pt: 'Acumulado', ru: 'Накопительно', ar: 'تراكمي', zh: '累计', ja: '累計', hi: 'संचयी' },
  Less: { es: 'Menos', fr: 'Moins', de: 'Weniger', pt: 'Menos', ru: 'Меньше', ar: 'أقل', zh: '较少', ja: '少ない', hi: 'कम' },
  More: { es: 'Más', fr: 'Plus', de: 'Mehr', pt: 'Mais', ru: 'Больше', ar: 'أكثر', zh: '较多', ja: '多い', hi: 'अधिक' },
  'Lifetime tokens': { es: 'Tokens totales', fr: 'Tokens cumulés', de: 'Tokens gesamt', pt: 'Tokens totais', ru: 'Всего токенов', ar: 'إجمالي الرموز', zh: '累计 Token', ja: '累計トークン', hi: 'कुल टोकन' },
  'Peak tokens': { es: 'Pico de tokens', fr: 'Pic de tokens', de: 'Spitzen-Tokens', pt: 'Pico de tokens', ru: 'Пик токенов', ar: 'ذروة الرموز', zh: '峰值 Token', ja: 'ピークトークン', hi: 'शिखर टोकन' },
  'Most used model': { es: 'Modelo más usado', fr: 'Modèle le plus utilisé', de: 'Meistgenutztes Modell', pt: 'Modelo mais usado', ru: 'Самая используемая модель', ar: 'النموذج الأكثر استخدامًا', zh: '最常用模型', ja: '最も使用したモデル', hi: 'सबसे अधिक उपयोग किया गया मॉडल' },
  'Longest streak': { es: 'Racha más larga', fr: 'Plus longue série', de: 'Längste Serie', pt: 'Maior sequência', ru: 'Самая длинная серия', ar: 'أطول تتابع', zh: '最长连续', ja: '最長連続', hi: 'सबसे लंबी श्रृंखला' },
  'Current streak': { es: 'Racha actual', fr: 'Série actuelle', de: 'Aktuelle Serie', pt: 'Sequência atual', ru: 'Текущая серия', ar: 'التتابع الحالي', zh: '当前连续', ja: '現在の連続', hi: 'वर्तमान श्रृंखला' },
  day: { es: 'día', fr: 'jour', de: 'Tag', pt: 'dia', ru: 'день', ar: 'يوم', zh: '天', ja: '日', hi: 'दिन' },
  days: { es: 'días', fr: 'jours', de: 'Tage', pt: 'dias', ru: 'дней', ar: 'أيام', zh: '天', ja: '日', hi: 'दिन' },

  // ---- console / composer ----
  'Choose a workspace to start': { es: 'Elige un espacio de trabajo para empezar', fr: 'Choisissez un espace de travail pour commencer', de: 'Wählen Sie einen Arbeitsbereich zum Starten', pt: 'Escolha um espaço de trabalho para começar', ru: 'Выберите рабочее пространство для начала', ar: 'اختر مساحة عمل للبدء', zh: '选择一个工作区以开始', ja: '開始するワークスペースを選択', hi: 'शुरू करने के लिए एक वर्कस्पेस चुनें' },
  'Open folder': { es: 'Abrir carpeta', fr: 'Ouvrir un dossier', de: 'Ordner öffnen', pt: 'Abrir pasta', ru: 'Открыть папку', ar: 'فتح مجلد', zh: '打开文件夹', ja: 'フォルダを開く', hi: 'फ़ोल्डर खोलें' },
  Agents: { es: 'Agentes', fr: 'Agents', de: 'Agenten', pt: 'Agentes', ru: 'Агенты', ar: 'الوكلاء', zh: '代理', ja: 'エージェント', hi: 'एजेंट' },
  'Bypass permissions': { es: 'Omitir permisos', fr: 'Ignorer les autorisations', de: 'Berechtigungen umgehen', pt: 'Ignorar permissões', ru: 'Обойти разрешения', ar: 'تجاوز الأذونات', zh: '绕过权限', ja: '権限をバイパス', hi: 'अनुमतियाँ बायपास करें' },
  Auto: { es: 'Automático', fr: 'Auto', de: 'Auto', pt: 'Automático', ru: 'Авто', ar: 'تلقائي', zh: '自动', ja: '自動', hi: 'स्वतः' },
  Manual: { es: 'Manual', fr: 'Manuel', de: 'Manuell', pt: 'Manual', ru: 'Вручную', ar: 'يدوي', zh: '手动', ja: '手動', hi: 'मैनुअल' },
}

let current: Lang = 'en'
const listeners = new Set<() => void>()

/** Set the active UI language and notify all subscribed components to re-render. */
export function setLang(code: string): void {
  current = (code || 'en') as Lang
  for (const fn of [...listeners]) fn()
}

export function getLang(): Lang {
  return current
}

export function translate(key: string, lang: Lang = current): string {
  if (lang === 'en') return key
  return dict[key]?.[lang as Target] ?? key
}

/** Translate hook — returns `t(key)` and re-renders the component on language change. */
export function useT(): (key: string) => string {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    listeners.add(bump)
    return () => {
      listeners.delete(bump)
    }
  }, [])
  return (key: string) => translate(key, current)
}
