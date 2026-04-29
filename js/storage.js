/**
 * Storage Manager - Supabase + localStorage dual-write
 * All methods are async, callers must use await.
 * localStorage serves as fast cache; Supabase is source of truth.
 */
var Storage = (function() {
  var PREFIX = 'quiz_hj1237_';
  var _cache = {}; // in-memory cache for current session

  // ---- Local helpers ----
  function _key(k) { return PREFIX + k; }

  function _localGet(key, def) {
    try {
      var v = localStorage.getItem(_key(key));
      return v !== null ? JSON.parse(v) : def;
    } catch(e) { return def; }
  }

  function _localSet(key, val) {
    try { localStorage.setItem(_key(key), JSON.stringify(val)); } catch(e) {}
  }

  function _getUserId() {
    return (typeof Auth !== 'undefined' && Auth.getCurrentUserId) ? Auth.getCurrentUserId() : null;
  }

  // ---- Supabase: upsert progress row ----
  async function _upsertProgress(qId, fields) {
    var userId = _getUserId();
    if (!userId) return;
    var chapterId = fields.chapter_id || '';
    try {
      await supabase.from('user_progress').upsert({
        user_id: userId,
        question_id: qId,
        chapter_id: chapterId,
        ...fields,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,question_id' });
    } catch(e) { console.warn('Supabase upsert failed:', e); }
  }

  // ---- Sync: pull all progress from Supabase into local cache ----
  async function syncFromServer() {
    var userId = _getUserId();
    if (!userId) return;
    try {
      var { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      if (!data) return;

      // Rebuild local cache from server data
      var practiced = {}; // { chapterId: [qId, ...] }
      var wrongList = [];
      var favList = [];
      var masteredList = [];

      data.forEach(function(row) {
        if (row.is_practiced && row.chapter_id) {
          if (!practiced[row.chapter_id]) practiced[row.chapter_id] = [];
          practiced[row.chapter_id].push(row.question_id);
        }
        if (row.is_wrong) wrongList.push(row.question_id);
        if (row.is_favorite) favList.push(row.question_id);
        if (row.is_mastered) masteredList.push(row.question_id);
      });

      // Write to localStorage
      Object.keys(practiced).forEach(function(chId) {
        _localSet('practiced_' + chId, practiced[chId]);
      });
      _localSet('wrong', wrongList);
      _localSet('favorites', favList);
      _localSet('mastered', masteredList);

      // Sync exam history
      var { data: examData } = await supabase
        .from('exam_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (examData) {
        var history = examData.map(function(r) {
          return {
            date: r.created_at ? new Date(r.created_at).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '',
            score: r.score,
            total: r.total,
            correct: r.correct,
            wrong: r.wrong,
            usedTime: r.used_time
          };
        });
        _localSet('exam_history', history);
      }

      _cache._synced = true;
    } catch(e) {
      console.warn('Sync from server failed, using local data:', e);
    }
  }

  // ---- Progress ----
  function getPracticed(chapterId) {
    return _localGet('practiced_' + chapterId, []);
  }

  async function addPracticed(chapterId, qId) {
    var list = getPracticed(chapterId);
    if (list.indexOf(qId) === -1) {
      list.push(qId);
      _localSet('practiced_' + chapterId, list);
    }
    await _upsertProgress(qId, { is_practiced: true, chapter_id: chapterId });
  }

  async function resetChapterProgress(chapterId) {
    var userId = _getUserId();
    if (!userId) return;
    var list = getPracticed(chapterId);
    _localSet('practiced_' + chapterId, []);
    // Mark all as not practiced in Supabase
    try {
      if (list.length > 0) {
        await supabase.from('user_progress')
          .update({ is_practiced: false, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('chapter_id', chapterId);
      }
    } catch(e) { console.warn('Reset chapter failed:', e); }
  }

  function getAllPracticedCount() {
    var count = 0;
    var chapters = (typeof App !== 'undefined' && App.getAllChapters) ? App.getAllChapters() : QB_CHAPTERS;
    chapters.forEach(function(ch) {
      count += getPracticed(ch.id).length;
    });
    return count;
  }

  // ---- Wrong Book ----
  function getWrongList() {
    return _localGet('wrong', []);
  }

  async function addWrong(qId) {
    var list = getWrongList();
    if (list.indexOf(qId) === -1) {
      list.push(qId);
      _localSet('wrong', list);
    }
    await _upsertProgress(qId, { is_wrong: true });
  }

  async function removeWrong(qId) {
    var list = getWrongList().filter(function(id) { return id !== qId; });
    _localSet('wrong', list);
    await _upsertProgress(qId, { is_wrong: false });
  }

  function isWrong(qId) {
    return getWrongList().indexOf(qId) !== -1;
  }

  // ---- Favorites ----
  function getFavorites() {
    return _localGet('favorites', []);
  }

  async function toggleFavorite(qId) {
    var list = getFavorites();
    var idx = list.indexOf(qId);
    var added;
    if (idx === -1) {
      list.push(qId);
      added = true;
    } else {
      list.splice(idx, 1);
      added = false;
    }
    _localSet('favorites', list);
    await _upsertProgress(qId, { is_favorite: added });
    return added;
  }

  function isFavorite(qId) {
    return getFavorites().indexOf(qId) !== -1;
  }

  // ---- Exam History ----
  function getExamHistory() {
    return _localGet('exam_history', []);
  }

  async function addExamHistory(record) {
    var userId = _getUserId();
    if (!userId) return;
    var list = getExamHistory();
    list.unshift(record);
    if (list.length > 10) list = list.slice(0, 10);
    _localSet('exam_history', list);
    try {
      await supabase.from('exam_history').insert({
        user_id: userId,
        score: record.score,
        total: record.total,
        correct: record.correct,
        wrong: record.wrong,
        used_time: record.usedTime
      });
    } catch(e) { console.warn('Save exam history failed:', e); }
  }

  // ---- Mastered ----
  function getMastered() {
    return _localGet('mastered', []);
  }

  async function addMastered(qId) {
    var list = getMastered();
    if (list.indexOf(qId) === -1) {
      list.push(qId);
      _localSet('mastered', list);
    }
    await _upsertProgress(qId, { is_mastered: true });
  }

  // ---- Reset All ----
  async function resetAll() {
    var userId = _getUserId();
    // Clear local
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) keys.push(k);
    }
    keys.forEach(function(k) { localStorage.removeItem(k); });

    // Clear remote
    try {
      if (userId) {
        await supabase.from('user_progress').delete().eq('user_id', userId);
        await supabase.from('exam_history').delete().eq('user_id', userId);
      }
    } catch(e) { console.warn('Remote reset failed:', e); }
  }

  // ---- Custom questions/chapters (Supabase) ----
  async function getCustomQuestions() {
    // Custom questions are stored directly in the questions table
    return [];
  }

  async function listUsers() {
    try {
      var result = await supabase
        .from('user_profiles')
        .select('id,email,role,is_banned,created_at,updated_at')
        .order('created_at', { ascending: false });
      if (result.error) throw result.error;
      return result.data || [];
    } catch (e) {
      console.warn('List users failed:', e);
      return [];
    }
  }

  async function setUserBanStatus(userId, banned) {
    try {
      var result = await supabase
        .from('user_profiles')
        .update({
          is_banned: !!banned,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      if (result.error) throw result.error;
      return true;
    } catch (e) {
      console.warn('Set user ban status failed:', e);
      return false;
    }
  }

  async function addQuestion(q) {
    try {
      var { error } = await supabase.from('questions').insert({
        id: q.id,
        chapter_id: q.chapterId,
        type: q.type,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation || ''
      });
      if (error) throw error;
      return true;
    } catch(e) { console.warn('Add question failed:', e); return false; }
  }

  async function updateQuestion(q) {
    try {
      var { error } = await supabase.from('questions').update({
        chapter_id: q.chapterId,
        type: q.type,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation || ''
      }).eq('id', q.id);
      if (error) throw error;
      return true;
    } catch(e) { console.warn('Update question failed:', e); return false; }
  }

  async function deleteQuestion(qId) {
    try {
      var { error } = await supabase.from('questions').delete().eq('id', qId);
      if (error) throw error;
      return true;
    } catch(e) { console.warn('Delete question failed:', e); return false; }
  }

  async function addChapter(ch) {
    try {
      var { error } = await supabase.from('chapters').insert({
        id: ch.id,
        name: ch.name,
        sort_order: ch.order
      });
      if (error) throw error;
      return true;
    } catch(e) { console.warn('Add chapter failed:', e); return false; }
  }

  async function deleteChapter(chId) {
    try {
      var { error } = await supabase.from('chapters').delete().eq('id', chId);
      if (error) throw error;
      return true;
    } catch(e) { console.warn('Delete chapter failed:', e); return false; }
  }

  return {
    syncFromServer: syncFromServer,
    getPracticed: getPracticed,
    addPracticed: addPracticed,
    resetChapterProgress: resetChapterProgress,
    getAllPracticedCount: getAllPracticedCount,
    getWrongList: getWrongList,
    addWrong: addWrong,
    removeWrong: removeWrong,
    isWrong: isWrong,
    getFavorites: getFavorites,
    toggleFavorite: toggleFavorite,
    isFavorite: isFavorite,
    getExamHistory: getExamHistory,
    addExamHistory: addExamHistory,
    getMastered: getMastered,
    addMastered: addMastered,
    resetAll: resetAll,
    getCustomQuestions: getCustomQuestions,
    listUsers: listUsers,
    setUserBanStatus: setUserBanStatus,
    addQuestion: addQuestion,
    updateQuestion: updateQuestion,
    deleteQuestion: deleteQuestion,
    addChapter: addChapter,
    deleteChapter: deleteChapter
  };
})();
