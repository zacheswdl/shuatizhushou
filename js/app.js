/**
 * Core Application Logic
 * Navigation, state management, utilities
 * Data loaded from Supabase with fallback to built-in questions.js
 */
var App = (function() {
  var _history = ['home'];
  var _currentPage = 'home';
  var _chapters = [];
  var _questions = [];
  var _dataReady = false;

  // ---- Data loading from Supabase ----
  async function loadData() {
    try {
      // Load chapters
      var { data: chData, error: chErr } = await supabase
        .from('chapters')
        .select('*')
        .order('sort_order', { ascending: true });
      if (chErr) throw chErr;

      // Load questions
      var { data: qData, error: qErr } = await supabase
        .from('questions')
        .select('*');
      if (qErr) throw qErr;

      if (chData && chData.length > 0) {
        _chapters = chData.map(function(c) {
          return { id: c.id, name: c.name, order: c.sort_order };
        });
      } else {
        _chapters = QB_CHAPTERS.slice();
      }

      if (qData && qData.length > 0) {
        _questions = qData.map(function(q) {
          return {
            id: q.id,
            chapterId: q.chapter_id,
            type: q.type,
            question: q.question,
            options: Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? JSON.parse(q.options) : []),
            answer: q.answer,
            explanation: q.explanation || ''
          };
        });
      } else {
        _questions = QB_QUESTIONS.slice();
      }

      _dataReady = true;
    } catch(e) {
      console.warn('Failed to load from Supabase, using built-in data:', e);
      _chapters = QB_CHAPTERS.slice();
      _questions = QB_QUESTIONS.slice();
      _dataReady = true;
    }
  }

  // ---- Data helpers ----
  function getAllChapters() {
    return _chapters.length > 0 ? _chapters : QB_CHAPTERS;
  }

  function getAllQuestions() {
    return _questions.length > 0 ? _questions : QB_QUESTIONS;
  }

  function getQuestionsByChapter(chapterId) {
    return getAllQuestions().filter(function(q) { return q.chapterId === chapterId; });
  }

  function getQuestionById(qId) {
    var all = getAllQuestions();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === qId) return all[i];
    }
    return null;
  }

  function getTypeLabel(type) {
    var m = { single: '单选', multiple: '多选', judgement: '判断', essay: '简答' };
    return m[type] || type;
  }

  function getTypeTag(type) {
    var m = { single: 'tag-blue', multiple: 'tag-purple', judgement: 'tag-green', essay: 'tag-yellow' };
    return m[type] || 'tag-blue';
  }

  // ---- Reload data from Supabase (for admin changes) ----
  async function reloadData() {
    await loadData();
  }

  // ---- Navigation ----
  function navigate(page, data) {
    _history.push(page);
    _showPage(page, data);
  }

  function goBack() {
    if (_history.length > 1) {
      _history.pop();
      var prev = _history[_history.length - 1];
      _showPage(prev);
    }
  }

  function switchTab(tab) {
    var pageMap = {
      home: 'home',
      practice: 'practice',
      exam: 'exam',
      wrong: 'wrong'
    };
    var page = pageMap[tab] || 'home';
    _history = [page];
    _showPage(page);
    document.querySelectorAll('.tab-item').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-page') === tab || (tab === 'wrong' && el.getAttribute('data-page') === 'settings'));
    });
  }

  function _showPage(page, data) {
    _currentPage = page;
    document.querySelectorAll('.page').forEach(function(el) { el.classList.remove('active'); });

    var backBtn = document.getElementById('btnBack');
    var title = document.getElementById('headerTitle');
    var headerRight = document.getElementById('headerRight');
    headerRight.innerHTML = '';

    var mainPages = ['home', 'practice', 'exam', 'wrong'];
    backBtn.classList.toggle('hidden', mainPages.indexOf(page) !== -1);

    switch(page) {
      case 'home':
        title.textContent = '刷题助手';
        document.getElementById('pageHome').classList.add('active');
        _updateHomeStats();
        break;
      case 'practice':
        title.textContent = '章节练习';
        document.getElementById('pagePractice').classList.add('active');
        Practice.renderChapterList();
        break;
      case 'practiceQuiz':
        title.textContent = '练习';
        document.getElementById('pagePracticeQuiz').classList.add('active');
        Practice.startPractice(data);
        break;
      case 'exam':
        title.textContent = '模拟考试';
        document.getElementById('pageExam').classList.add('active');
        Exam.renderSetup();
        break;
      case 'examQuiz':
        title.textContent = '考试中';
        document.getElementById('pageExamQuiz').classList.add('active');
        Exam.startExam(data);
        break;
      case 'examResult':
        title.textContent = '考试结果';
        document.getElementById('pageExamResult').classList.add('active');
        break;
      case 'wrong':
        title.textContent = '错题本';
        document.getElementById('pageWrong').classList.add('active');
        Wrong.render();
        break;
      case 'favorite':
        title.textContent = '收藏夹';
        document.getElementById('pageFavorite').classList.add('active');
        Favorite.render();
        break;
      case 'admin':
        title.textContent = '后台管理';
        document.getElementById('pageAdmin').classList.add('active');
        Admin.render();
        break;
    }
  }

  // ---- Home Stats ----
  function _updateHomeStats() {
    var total = getAllQuestions().length;
    var done = Storage.getAllPracticedCount();
    var wrong = Storage.getWrongList().length;
    var fav = Storage.getFavorites().length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statDone').textContent = done;
    document.getElementById('statWrong').textContent = wrong;
    document.getElementById('statFav').textContent = fav;

    var pct = total > 0 ? Math.round(done / total * 100) : 0;
    document.getElementById('progressPercent').textContent = pct + '%';
    document.getElementById('progressFill').style.width = pct + '%';
  }

  // ---- Toast ----
  function toast(msg, duration) {
    duration = duration || 2000;
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(function() { el.classList.add('hidden'); }, duration);
  }

  // ---- Modal ----
  function showModal(title, body, actions) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    var actEl = document.getElementById('modalActions');
    actEl.innerHTML = '';
    (actions || []).forEach(function(a) {
      var btn = document.createElement('button');
      btn.className = 'btn ' + (a.cls || 'btn-outline');
      btn.textContent = a.text;
      btn.onclick = function() {
        hideModal();
        if (a.fn) a.fn();
      };
      actEl.appendChild(btn);
    });
    document.getElementById('modalOverlay').classList.remove('hidden');
  }

  function hideModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
  }

  // ---- Reset Progress ----
  function resetProgress() {
    showModal('重置进度', '确定要重置所有学习进度吗？<br>已练习记录、错题本、收藏夹都将被清除。', [
      { text: '取消', cls: 'btn-outline' },
      { text: '确定重置', cls: 'btn-danger', fn: async function() {
        await Storage.resetAll();
        _updateHomeStats();
        toast('已重置所有进度');
      }}
    ]);
  }

  // ---- Shuffle array ----
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---- Escape HTML ----
  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ---- Init ----
  async function init() {
    // Check activation first
    if (!Activation.isActivated()) {
      Activation.renderModal();
      // Store the post-activation init function
      window._appInitAfterActivation = function() { init(); };
      return;
    }

    // Show app container
    document.getElementById('app').style.display = '';

    // Show loading
    document.getElementById('headerTitle').textContent = '加载中...';

    // Load data from Supabase
    await loadData();

    // Sync user progress from Supabase
    await Storage.syncFromServer();

    // Update UI
    _updateHomeStats();
    document.getElementById('headerTitle').textContent = '刷题助手';

    // Click overlay to close modal
    document.getElementById('modalOverlay').addEventListener('click', function(e) {
      if (e.target === this) hideModal();
    });
  }

  document.addEventListener('DOMContentLoaded', function() { init(); });

  return {
    navigate: navigate,
    goBack: goBack,
    switchTab: switchTab,
    toast: toast,
    showModal: showModal,
    hideModal: hideModal,
    resetProgress: resetProgress,
    reloadData: reloadData,
    getAllChapters: getAllChapters,
    getAllQuestions: getAllQuestions,
    getQuestionsByChapter: getQuestionsByChapter,
    getQuestionById: getQuestionById,
    getTypeLabel: getTypeLabel,
    getTypeTag: getTypeTag,
    shuffle: shuffle,
    escHtml: escHtml
  };
})();