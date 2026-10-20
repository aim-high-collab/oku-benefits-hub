// Interface text in Bahasa Malaysia, English and Chinese. Keys are the English text, so any string that has no
// translation yet simply shows in English. Listing content (names, offers, descriptions) is shown as entered.
export const LANGS = [['ms', 'BM', 'Bahasa Malaysia'], ['en', 'EN', 'English'], ['zh', '中文', '中文']];

const KEY = 'oku-lang';
let lang = 'en';
try { lang = localStorage.getItem(KEY) || 'en'; } catch { /* storage blocked */ }
if (!LANGS.some(([c]) => c === lang)) lang = 'en';

export const getLang = () => lang;
export function setLang(code) {
  lang = code;
  try { localStorage.setItem(KEY, code); } catch { /* storage blocked */ }
  document.documentElement.lang = code;
}
document.documentElement.lang = lang;

/** t('{n} places', { n: 3 }) */
export function t(text, vars) {
  let s = (lang !== 'en' && DICT[text]?.[lang === 'ms' ? 0 : 1]) || text;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

// [Bahasa Malaysia, 中文]
const DICT = {
  // header & navigation
  'Places': ['Tempat', '地点'],
  'Add a place': ['Tambah tempat', '添加地点'],
  'For businesses': ['Untuk peniaga', '商家专区'],
  'Official help': ['Bantuan rasmi', '官方援助'],
  'Moderation': ['Moderasi', '审核'],
  'Log in': ['Log masuk', '登录'],
  'Log out': ['Log keluar', '退出'],
  'Sign up': ['Daftar', '注册'],
  'Menu': ['Menu', '菜单'],
  'Language': ['Bahasa', '语言'],
  'Calm mode': ['Mod tenang', '安静模式'],
  'Calm': ['Tenang', '安静'],
  'Skip to main content': ['Langkau ke kandungan utama', '跳到主要内容'],
  'Loading…': ['Memuatkan…', '加载中…'],
  'Back to places': ['Kembali ke senarai tempat', '返回地点列表'],
  'A community project, not affiliated with JKM or any government agency. Always confirm with the provider before you travel.': [
    'Projek komuniti, tidak bergabung dengan JKM atau mana-mana agensi kerajaan. Sentiasa sahkan dengan penyedia sebelum anda pergi.',
    '这是一个社区项目，与社会福利局或任何政府机构无关。出发前请先向商家确认。'],

  // explore
  'Places that say': ['Tempat yang kata', '对你的OKU卡说'],
  'yes': ['ya', '好'],
  'to your OKU card': ['kepada kad OKU anda', '的地方'],
  'Search places': ['Cari tempat', '搜索地点'],
  'Search a place, town or offer': ['Cari tempat, bandar atau tawaran', '搜索地点、城镇或优惠'],
  'Use my location to sort by distance': ['Guna lokasi saya untuk susun ikut jarak', '用我的位置按距离排序'],
  'Locating…': ['Mencari lokasi…', '正在定位…'],
  'Sorted by distance from you.': ['Disusun ikut jarak dari anda.', '已按与你的距离排序。'],
  'Kind of offer': ['Jenis tawaran', '优惠类型'],
  'All': ['Semua', '全部'],
  'Free': ['Percuma', '免费'],
  'Discount': ['Diskaun', '折扣'],
  'Priority': ['Keutamaan', '优先'],
  'Freebie': ['Hadiah', '赠品'],
  'Volunteer': ['Sukarelawan', '义工'],
  'Filters': ['Penapis', '筛选'],
  'Filters · {n}': ['Penapis · {n}', '筛选 · {n}'],
  'Type of place': ['Jenis tempat', '地点类型'],
  'All types': ['Semua jenis', '所有类型'],
  'Sort by': ['Susun ikut', '排序'],
  'Recommended': ['Disyorkan', '推荐'],
  'Nearest to me': ['Paling dekat', '离我最近'],
  'Top rated': ['Penilaian tertinggi', '评分最高'],
  'Getting in and around': ['Masuk dan bergerak', '进出与通行'],
  'Only show places with all ticked features.': ['Tunjuk tempat yang ada semua ciri yang ditanda sahaja.', '只显示具备所有已勾选设施的地点。'],
  'Also show places where we don’t know yet': ['Tunjuk juga tempat yang kami belum tahu', '也显示尚不清楚的地点'],
  'They are marked “Not known”, so you can ask before you go.': ['Ia ditanda “Belum diketahui”, jadi anda boleh bertanya dahulu.', '这些地点标为“未知”，你可以先询问。'],
  'How sure': ['Sejauh mana pasti', '可信程度'],
  'Show {n} places': ['Tunjuk {n} tempat', '显示 {n} 个地点'],
  'Clear': ['Kosongkan', '清除'],
  'Close filters': ['Tutup penapis', '关闭筛选'],
  'Show results as': ['Tunjuk hasil sebagai', '结果显示方式'],
  'List': ['Senarai', '列表'],
  'Map': ['Peta', '地图'],
  '1 place': ['1 tempat', '1 个地点'],
  '{n} places': ['{n} tempat', '{n} 个地点'],
  'No places match yet.': ['Belum ada tempat yang sepadan.', '暂时没有符合的地点。'],
  'Try removing a filter, or': ['Cuba buang penapis, atau', '试试移除筛选，或'],
  'add one you know': ['tambah tempat yang anda tahu', '添加你知道的地点'],
  '+{n} more': ['+{n} lagi', '还有 {n} 个'],
  'Map of places. The same places are in the list, with the same numbers.': [
    'Peta tempat. Tempat yang sama ada dalam senarai, dengan nombor yang sama.', '地点地图。列表中有相同的地点和编号。'],
  'Map loads when you open it, to save data.': ['Peta dimuatkan bila anda buka, untuk jimat data.', '为节省流量，打开时才加载地图。'],
  'View details': ['Lihat butiran', '查看详情'],
  'Show on map': ['Tunjuk di peta', '在地图上显示'],

  // trust
  'Business confirmed': ['Disahkan peniaga', '商家已确认'],
  'Community reported': ['Dilaporkan komuniti', '社区报告'],
  'Not yet checked': ['Belum disemak', '尚未核实'],
  'by the business · {date}': ['oleh peniaga · {date}', '由商家确认 · {date}'],
  '{n} visits said it worked': ['{n} lawatan kata ia berjaya', '{n} 次到访表示有效'],
  'suggested by a visitor who used it': ['dicadangkan oleh pelawat yang pernah guna', '由用过的访客推荐'],
  'from web sources or a tip · confirm before you go': ['dari sumber web atau maklumat · sahkan sebelum pergi', '来自网络或线索 · 出发前请确认'],
  'How sure is this?': ['Sejauh mana pasti?', '这个信息有多可靠？'],
  'Worked {a} of {b} visits': ['Berjaya {a} daripada {b} lawatan', '{b} 次到访中有 {a} 次有效'],
  'No one has reported a visit yet.': ['Belum ada yang melaporkan lawatan.', '还没有人报告到访。'],
  'Been here? Did the OKU offer work?': ['Pernah ke sini? Adakah tawaran OKU berjaya?', '来过这里吗？OKU优惠有效吗？'],
  'No account needed. Your answer updates the count above.': ['Tidak perlu akaun. Jawapan anda mengemas kini kiraan di atas.', '不需要账号。你的回答会更新上面的统计。'],
  'Yes': ['Ya', '有效'],
  'No': ['Tidak', '无效'],
  'Partly': ['Sebahagian', '部分有效'],
  'Thank you. Your answer is counted.': ['Terima kasih. Jawapan anda dikira.', '谢谢，你的回答已记录。'],
  'You already answered for this place on this device.': ['Anda sudah menjawab untuk tempat ini pada peranti ini.', '你已在此设备上回答过这个地点。'],

  // place page
  'At a glance': ['Ringkasan', '一览'],
  'Valid until {date}': ['Sah sehingga {date}', '有效期至 {date}'],
  'Bring your OKU card.': ['Bawa kad OKU anda.', '请带上你的OKU卡。'],
  'Nothing listed yet.': ['Belum ada tawaran.', '暂无优惠。'],
  'Offers & ways to help': ['Tawaran & cara membantu', '优惠与参与方式'],
  'How to claim': ['Cara menuntut', '如何使用'],
  'Go to the counter or ticket desk as usual.': ['Pergi ke kaunter atau tempat tiket seperti biasa.', '像平常一样到柜台或售票处。'],
  'Show your OKU card before you pay.': ['Tunjuk kad OKU anda sebelum membayar.', '付款前出示你的OKU卡。'],
  'Check the price or receipt shows the OKU offer.': ['Pastikan harga atau resit menunjukkan tawaran OKU.', '确认价格或收据已包含OKU优惠。'],
  'Show the cashier': ['Tunjuk kepada juruwang', '给收银员看'],
  'Turn your phone round to show this.': ['Pusingkan telefon anda untuk tunjuk ini.', '把手机转过去给对方看。'],
  'Close': ['Tutup', '关闭'],
  'Accessibility': ['Kebolehcapaian', '无障碍设施'],
  'Not known yet. Ask the place before you go, or': ['Belum diketahui. Tanya tempat itu dahulu, atau', '尚不清楚。出发前请先询问，或'],
  'add what you know': ['tambah apa yang anda tahu', '补充你知道的信息'],
  'Ask before you go': ['Tanya sebelum pergi', '出发前先询问'],
  'WhatsApp': ['WhatsApp', 'WhatsApp'],
  'SMS': ['SMS', '短信'],
  'Call {n}': ['Telefon {n}', '致电 {n}'],
  'Directions': ['Arah', '路线'],
  'Suggest an edit': ['Cadang suntingan', '建议修改'],
  'Offer ended or wrong? Answer “No” above, or suggest an edit.': ['Tawaran tamat atau salah? Jawab “Tidak” di atas, atau cadang suntingan.', '优惠已结束或有误？请在上面选“无效”，或建议修改。'],
  'About this place': ['Tentang tempat ini', '关于这个地点'],
  'Reviews': ['Ulasan', '评价'],
  'No reviews yet': ['Belum ada ulasan', '暂无评价'],
  'Location and contact': ['Lokasi dan hubungan', '位置与联系方式'],

  // add a place
  'No account needed. A moderator checks every suggestion before it appears.': [
    'Tidak perlu akaun. Moderator menyemak setiap cadangan sebelum ia dipaparkan.', '不需要账号。每条建议都会先由审核员检查再显示。'],
  'How do you know about this offer?': ['Bagaimana anda tahu tentang tawaran ini?', '你怎么知道这个优惠？'],
  'Your answer sets the label other people see.': ['Jawapan anda menentukan label yang orang lain lihat.', '你的回答决定其他人看到的标签。'],
  'I used it myself': ['Saya pernah guna sendiri', '我自己用过'],
  'I own or manage it, or the business told me': ['Saya pemilik atau pengurus, atau peniaga beritahu saya', '我是店主，或店家亲口告诉我'],
  'I saw it online or heard about it': ['Saya nampak dalam talian atau dengar', '我在网上看到或听别人说'],
  'Shows as “Community reported”.': ['Dipaparkan sebagai “Dilaporkan komuniti”.', '显示为“社区报告”。'],
  'A moderator contacts the business to confirm.': ['Moderator akan hubungi peniaga untuk sahkan.', '审核员会联系商家确认。'],
  'Shows as “Not yet checked”.': ['Dipaparkan sebagai “Belum disemak”.', '显示为“尚未核实”。'],
  'Valid until (optional)': ['Sah sehingga (pilihan)', '有效期至（可选）'],
  'Thank you! A moderator will check it before it appears.': ['Terima kasih! Moderator akan menyemak sebelum ia dipaparkan.', '谢谢！审核员检查后就会显示。'],
  'Log in to add a photo. You can still send everything else.': ['Log masuk untuk tambah foto. Anda masih boleh hantar maklumat lain.', '登录后才能添加照片。其他信息仍可提交。'],

  // official help
  'Government help for OKU': ['Bantuan kerajaan untuk OKU', '政府为OKU提供的援助'],
  'We don’t run these schemes and can’t check if you qualify. Each link opens the agency’s own website.': [
    'Kami tidak mengendalikan skim ini dan tidak boleh menyemak kelayakan anda. Setiap pautan membuka laman web agensi itu sendiri.',
    '这些计划不由我们管理，我们也无法确认你是否符合资格。每个链接都会打开该机构的官方网站。'],
  'Official website (opens in a new tab)': ['Laman web rasmi (buka tab baharu)', '官方网站（在新标签页打开）'],
  'Back to places that say yes': ['Kembali ke tempat yang kata ya', '返回对OKU卡说好的地点'],
  'Leave empty if there is no end date.': ['Biarkan kosong jika tiada tarikh tamat.', '没有截止日期就留空。'],
  'Choose how you know about this place.': ['Pilih bagaimana anda tahu tentang tempat ini.', '请选择你是怎么知道这个地点的。'],
  'Know a business that gives OKU discounts, a place that is genuinely accessible, or a group that welcomes volunteers? Add it so others can find it.': [
    'Tahu perniagaan yang beri diskaun OKU, tempat yang benar-benar mesra OKU, atau kumpulan yang alu-alukan sukarelawan? Tambahkan supaya orang lain boleh jumpa.',
    '知道给OKU折扣的商家、真正无障碍的地方，或欢迎义工的团体吗？添加它，让更多人找到。'],
  'Rules and amounts change. Check with the agency before you apply.': ['Syarat dan jumlah boleh berubah. Semak dengan agensi sebelum memohon.', '规定和金额可能会变，申请前请向相关机构确认。'],
  'Search official help': ['Cari bantuan rasmi', '搜索官方援助'],
  'Who can apply': ['Siapa boleh memohon', '谁可以申请'],
  'How to apply': ['Cara memohon', '如何申请'],
  'Link checked {date}': ['Pautan disemak {date}', '链接核实于 {date}'],
  'Link not yet checked': ['Pautan belum disemak', '链接尚未核实'],
  'Something out of date?': ['Ada yang sudah lapuk?', '有过时的信息吗？'],
  'Nothing matches.': ['Tiada padanan.', '没有符合的结果。'],
};
