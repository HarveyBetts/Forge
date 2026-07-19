// Mock @supabase/supabase-js — served in place of the CDN bundle so the app
// boots fully offline and deterministically (no live backend, no auth needed).
// It exposes the same surface the app touches (see CLAUDE.md §7 + grep of sb.*):
//   sb.auth.*, sb.from(...).<chainable/thenable>, sb.rpc, sb.channel,
//   sb.functions.invoke, sb.storage.from(...).upload/getPublicUrl
// Every query resolves to empty data with no error, so render code walks its
// "no data yet" branches — exactly the first-launch state we want to smoke-test.
(function () {
  function result(data) { return Promise.resolve({ data: data, error: null }); }

  // A chainable query builder that is also awaitable (thenable). All filter/
  // order/paging methods return `this`; terminal reads resolve to empty sets.
  function makeQuery() {
    var q = {};
    var chain = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq',
      'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains',
      'order', 'limit', 'range', 'filter', 'match', 'or', 'not', 'onConflict'];
    chain.forEach(function (m) { q[m] = function () { return q; }; });
    q.single = function () { return result(null); };
    q.maybeSingle = function () { return result(null); };
    q.csv = function () { return result(''); };
    // Thenable: `await sb.from('x').select()...` resolves to an empty list.
    q.then = function (res, rej) { return result([]).then(res, rej); };
    q.catch = function (cb) { return result([]).catch(cb); };
    q.finally = function (cb) { return result([]).finally(cb); };
    return q;
  }

  function makeChannel() {
    var ch = {};
    ch.on = function () { return ch; };
    ch.subscribe = function () { return ch; };
    ch.unsubscribe = function () { return Promise.resolve('ok'); };
    return ch;
  }

  function createClient() {
    return {
      auth: {
        // No session -> boot lands on the auth-login screen (booted, no error).
        getSession: function () { return Promise.resolve({ data: { session: null }, error: null }); },
        getUser: function () { return Promise.resolve({ data: { user: null }, error: null }); },
        onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
        signInWithPassword: function () { return Promise.resolve({ data: { session: null, user: null }, error: { message: 'mock: no auth' } }); },
        signUp: function () { return Promise.resolve({ data: { session: null, user: null }, error: null }); },
        resetPasswordForEmail: function () { return Promise.resolve({ data: {}, error: null }); },
        updateUser: function () { return Promise.resolve({ data: { user: null }, error: null }); },
        signOut: function () { return Promise.resolve({ error: null }); },
      },
      from: function () { return makeQuery(); },
      rpc: function () { return result([]); },
      channel: function () { return makeChannel(); },
      removeChannel: function () { return Promise.resolve('ok'); },
      functions: { invoke: function () { return Promise.resolve({ data: null, error: null }); } },
      storage: {
        from: function () {
          return {
            upload: function () { return Promise.resolve({ data: { path: 'mock' }, error: null }); },
            getPublicUrl: function () { return { data: { publicUrl: 'about:blank' } }; },
            remove: function () { return Promise.resolve({ data: [], error: null }); },
          };
        },
      },
    };
  }

  window.supabase = { createClient: createClient };
})();
