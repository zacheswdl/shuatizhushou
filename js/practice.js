/**
 * Practice Mode Module (Supabase version)
 * Chapter selection + sequential question practice
 */
var Practice = (function() {
  var _questions = [];
  var _currentIdx = 0;
  var _chapterId = '';
  var _answered = {};
  var _revealed = {};

  function renderChapterList() {
    var container = document.getElementById('pagePractice');
    var chapters = App.getAllChapters();
    var html = '<div class="chapter-list">';

    chapters.forEach(function(ch, i) {
      var qs = App.getQuestionsByChapter(ch.id);
      var practiced = Storage.getPracticed(ch.id);
      var total = qs.length;
      var done = practiced.length;
      var pct = total > 0 ? Math.round(done / total * 100) : 0;

      html += '<div class="chapter-card" onclick="Practice.selectChapter(\'' + ch.id + '\')">' +
        '<div class="chapter-num">' + (i + 1) + '</div>' +
        '<div class="chapter-info">' +
          '<div class="chapter-name">' + App.escHtml(ch.name) + '</div>' +
          '<div class="chapter-progress">' + done + '/' + total + ' 题 · ' + pct + '%</div>' +
          '<div class="progress-bar" style="margin-top:6px;height:4px;">' +
            '<div class="progress-fill" style="width:' + pct + '%"></div>' +
          '</div>' +
        '</div>' +
        '<div class="chapter-arrow">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
        '</div>' +
      '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
  }

  function selectChapter(chapterId) {
    _chapterId = chapterId;
    var allQs = App.getQuestionsByChapter(chapterId);
    var practiced = Storage.getPracticed(chapterId);

    var unpracticed = allQs.filter(function(q) {
      return practiced.indexOf(q.id) === -1;
    });

    if (unpracticed.length === 0) {
      App.showModal('已全部练习', '本章节题目已全部练习完毕，是否重置本章进度？', [
        { text: '返回', cls: 'btn-outline' },
        { text: '重置本章', cls: 'btn-primary', fn: async function() {
          await Storage.resetChapterProgress(chapterId);
          renderChapterList();
          App.toast('已重置本章进度');
        }}
      ]);
      return;
    }

    _questions = unpracticed;
    _currentIdx = 0;
    _answered = {};
    _revealed = {};
    App.navigate('practiceQuiz', { chapterId: chapterId });
  }

  function startPractice(data) {
    if (data && data.questions) {
      _questions = data.questions;
      _currentIdx = 0;
      _answered = {};
      _revealed = {};
    }
    _renderQuestion();
  }

  function _renderQuestion() {
    if (_questions.length === 0) return;
    var container = document.getElementById('pagePracticeQuiz');
    var q = _questions[_currentIdx];
    var totalInChapter = App.getQuestionsByChapter(_chapterId).length;
    var practicedCount = Storage.getPracticed(_chapterId).length;
    var isFav = Storage.isFavorite(q.id);
    var hasAnswered = _answered.hasOwnProperty(q.id);
    var isRevealed = _revealed[q.id];

    var ch = App.getAllChapters().filter(function(c) { return c.id === _chapterId; })[0];
    document.getElementById('headerTitle').textContent = (ch ? ch.name : '练习') + ' (' + (_currentIdx + 1) + '/' + _questions.length + ')';

    document.getElementById('headerRight').innerHTML =
      '<button class="header-back" onclick="Practice.toggleSheet()" title="答题卡">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' +
      '</button>';

    var html = '<div class="question-card">';
    html += '<div class="q-header">' +
      '<span class="tag ' + App.getTypeTag(q.type) + '">' + App.getTypeLabel(q.type) + '</span>' +
      '<span class="q-index">第 ' + (_currentIdx + 1) + ' 题</span>' +
      '<span style="flex:1"></span>' +
      '<span style="font-size:12px;color:var(--gray-400)">本章 ' + practicedCount + '/' + totalInChapter + '</span>' +
    '</div>';

    html += '<div class="q-stem">' + App.escHtml(q.question).replace(/\n/g, '<br>') + '</div>';

    if (q.type === 'essay') {
      html += _renderEssay(q, hasAnswered, isRevealed);
    } else {
      html += _renderOptions(q, hasAnswered, isRevealed);
    }

    if (isRevealed && q.explanation) {
      html += '<div class="explanation-box">' +
        '<div class="exp-title">📖 解析</div>' +
        '<div class="exp-content">' + App.escHtml(q.explanation) + '</div>' +
      '</div>';
    }

    html += '<div class="q-actions">' +
      '<button class="q-action-btn ' + (isFav ? 'favorited' : '') + '" onclick="Practice.toggleFav()">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (isFav ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
        (isFav ? ' 已收藏' : ' 收藏') +
      '</button>';

    if (isRevealed) {
      html += '<button class="q-action-btn" onclick="Practice.markMastered()" style="border-color:var(--success);color:var(--success)">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> 已掌握' +
      '</button>';
    }
    html += '</div>';

    html += '<div class="q-nav">';
    if (_currentIdx > 0) {
      html += '<button class="btn btn-outline" onclick="Practice.prev()">上一题</button>';
    } else {
      html += '<div></div>';
    }
    if (isRevealed && _currentIdx < _questions.length - 1) {
      html += '<button class="btn btn-primary" onclick="Practice.next()">下一题</button>';
    } else if (isRevealed && _currentIdx === _questions.length - 1) {
      html += '<button class="btn btn-success" onclick="App.goBack()">完成</button>';
    } else {
      html += '<div></div>';
    }
    html += '</div>';

    html += '</div>';

    html += '<div id="practiceSheet" class="hidden" style="margin-top:16px">' +
      '<div style="font-size:15px;font-weight:600;color:var(--gray-700);margin-bottom:8px">答题卡</div>' +
      '<div class="answer-sheet">';
    _questions.forEach(function(qq, idx) {
      var cls = 'sheet-item';
      if (idx === _currentIdx) cls += ' current';
      else if (_answered[qq.id]) cls += ' answered';
      html += '<div class="' + cls + '" onclick="Practice.jumpTo(' + idx + ')">' + (idx + 1) + '</div>';
    });
    html += '</div></div>';

    container.innerHTML = html;
  }

  function _renderOptions(q, hasAnswered, isRevealed) {
    var html = '';
    var userAns = _answered[q.id] || (q.type === 'multiple' ? [] : '');
    var correctAns = q.answer;

    q.options.forEach(function(opt, i) {
      var letter = String.fromCharCode(65 + i);
      var cls = 'option-item';
      if (q.type === 'multiple') cls += ' multi';

      if (isRevealed) {
        cls += ' disabled';
        var isCorrect = correctAns.indexOf(letter) !== -1;
        var isSelected = q.type === 'multiple' ? userAns.indexOf(letter) !== -1 : userAns === letter;
        if (isCorrect) cls += ' correct';
        else if (isSelected && !isCorrect) cls += ' wrong';
      } else if (hasAnswered) {
        var isSel = q.type === 'multiple' ? userAns.indexOf(letter) !== -1 : userAns === letter;
        if (isSel) cls += ' selected';
      }

      html += '<div class="' + cls + '" onclick="Practice.selectOption(\'' + q.id + '\',\'' + letter + '\')">' +
        '<div class="option-label">' + letter + '</div>' +
        '<div class="option-text">' + App.escHtml(opt.replace(/^[A-E]\.\s*/, '')) + '</div>' +
      '</div>';
    });

    if (!isRevealed) {
      if (q.type === 'multiple') {
        html += '<button class="btn btn-primary btn-block" onclick="Practice.confirmAnswer(\'' + q.id + '\')" ' +
          (!hasAnswered || userAns.length === 0 ? 'disabled' : '') + '>确认提交</button>';
      }
    }

    if (isRevealed) {
      html += '<div class="answer-box"><div class="ans-title">正确答案</div>' +
        '<div class="ans-content">' + correctAns + '</div></div>';
    }

    return html;
  }

  function _renderEssay(q, hasAnswered, isRevealed) {
    var html = '';
    if (!isRevealed) {
      html += '<textarea class="essay-answer-area" id="essayInput" placeholder="请输入您的答案..."></textarea>' +
        '<div style="margin-top:12px">' +
        '<button class="btn btn-primary btn-block" onclick="Practice.revealEssay(\'' + q.id + '\')">查看参考答案</button>' +
        '</div>';
    } else {
      html += '<div class="answer-box"><div class="ans-title">参考答案</div>' +
        '<div class="ans-content">' + App.escHtml(q.answer).replace(/\n/g, '<br>') + '</div></div>';
    }
    return html;
  }

  function selectOption(qId, letter) {
    var q = App.getQuestionById(qId);
    if (!q || _revealed[qId]) return;

    if (q.type === 'multiple') {
      var sel = _answered[qId] || [];
      var idx = sel.indexOf(letter);
      if (idx === -1) sel.push(letter);
      else sel.splice(idx, 1);
      sel.sort();
      _answered[qId] = sel;
    } else {
      _answered[qId] = letter;
      _checkAndReveal(qId);
    }
    _renderQuestion();
  }

  function confirmAnswer(qId) {
    _checkAndReveal(qId);
    _renderQuestion();
  }

  async function _checkAndReveal(qId) {
    var q = App.getQuestionById(qId);
    if (!q) return;
    _revealed[qId] = true;

    await Storage.addPracticed(_chapterId, qId);

    var userAns = _answered[qId];
    var correct = q.answer;
    var isCorrect;

    if (q.type === 'multiple') {
      isCorrect = Array.isArray(userAns) && userAns.join('') === correct;
    } else {
      isCorrect = userAns === correct;
    }

    if (!isCorrect && q.type !== 'essay') {
      await Storage.addWrong(qId);
    } else {
      await Storage.removeWrong(qId);
    }
  }

  async function revealEssay(qId) {
    _revealed[qId] = true;
    await Storage.addPracticed(_chapterId, qId);
    _renderQuestion();
  }

  async function toggleFav() {
    var q = _questions[_currentIdx];
    var added = await Storage.toggleFavorite(q.id);
    App.toast(added ? '已添加到收藏' : '已取消收藏');
    _renderQuestion();
  }

  async function markMastered() {
    var q = _questions[_currentIdx];
    await Storage.addMastered(q.id);
    await Storage.removeWrong(q.id);
    App.toast('已标记为掌握');
    if (_currentIdx < _questions.length - 1) {
      next();
    } else {
      _renderQuestion();
    }
  }

  function prev() {
    if (_currentIdx > 0) {
      _currentIdx--;
      _renderQuestion();
      document.getElementById('mainContent').scrollTop = 0;
    }
  }

  function next() {
    if (_currentIdx < _questions.length - 1) {
      _currentIdx++;
      _renderQuestion();
      document.getElementById('mainContent').scrollTop = 0;
    }
  }

  function jumpTo(idx) {
    _currentIdx = idx;
    _renderQuestion();
    document.getElementById('mainContent').scrollTop = 0;
    document.getElementById('practiceSheet').classList.add('hidden');
  }

  function toggleSheet() {
    var el = document.getElementById('practiceSheet');
    if (el) el.classList.toggle('hidden');
  }

  return {
    renderChapterList: renderChapterList,
    selectChapter: selectChapter,
    startPractice: startPractice,
    selectOption: selectOption,
    confirmAnswer: confirmAnswer,
    revealEssay: revealEssay,
    toggleFav: toggleFav,
    markMastered: markMastered,
    prev: prev,
    next: next,
    jumpTo: jumpTo,
    toggleSheet: toggleSheet
  };
})();