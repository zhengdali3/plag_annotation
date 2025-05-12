// server/index.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const config  = require('./config');

const app      = express();
const port     = config.server.port;
const dataRoot = config.paths.dataRoot;
const srcRoot  = config.paths.sourceFilesDirectory;

app.use(cors());
app.use(express.json());

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// List folders under dataRoot ending in “-jplag”
function listDatasets() {
  return fs.readdirSync(dataRoot).filter(d => d.endsWith('-jplag'));
}

// Map a user‐supplied name → actual folder
function findDataset(name) {
  const all = listDatasets();
  if (all.includes(name)) return name;
  if (!name.endsWith('-jplag') && all.includes(name + '-jplag'))
    return name + '-jplag';
  const prefix = all.find(d => d.startsWith(name));
  return prefix || null;
}

// For migrations
const datasets       = listDatasets();
const defaultDataset = datasets[0];
console.log('🗂  Datasets found:', datasets, '→ default:', defaultDataset);

// ─── OPEN & MIGRATE SQLITE ───────────────────────────────────────────────────
const db = new sqlite3.Database(config.database.path, err => {
  if (err) { console.error(err); process.exit(1); }
  console.log('🚀 SQLite open:', config.database.path);

  db.serialize(() => {
    // 1) users
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        user_id   INTEGER PRIMARY KEY AUTOINCREMENT,
        username  TEXT    UNIQUE NOT NULL
      )
    `);

    // 2) old decisions
    db.run(`
      CREATE TABLE IF NOT EXISTS decisions (
        decision_id   INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER NOT NULL,
        case_filename TEXT    NOT NULL,
        timestamp     DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(user_id),
        UNIQUE(user_id, case_filename)
      )
    `);

    // 3) migrate decisions → add dataset/level/comment
    db.all(`PRAGMA table_info(decisions)`, (e, cols) => {
      if (e) return console.error(e);
      const names = cols.map(c => c.name);
      if (!names.includes('dataset')) {
        console.log('🛠 Migrating decisions → adding dataset/level/comment…');
        db.run(`ALTER TABLE decisions RENAME TO decisions_old`, err => {
          if (err) return console.error(err);
          db.run(`
            CREATE TABLE decisions (
              decision_id   INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id       INTEGER NOT NULL,
              dataset       TEXT    NOT NULL,
              case_filename TEXT    NOT NULL,
              level         INTEGER NOT NULL DEFAULT 3 CHECK(level BETWEEN 1 AND 5),
              comment       TEXT,
              timestamp     DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(user_id) REFERENCES users(user_id),
              UNIQUE(user_id, dataset, case_filename)
            )
          `, err => {
            if (err) return console.error(err);
            const sql = `
              INSERT INTO decisions
                (decision_id,user_id,dataset,case_filename,level,comment,timestamp)
              SELECT
                decision_id,
                user_id,
                ?            AS dataset,
                case_filename,
                3            AS level,
                NULL         AS comment,
                timestamp
              FROM decisions_old
            `;
            db.run(sql, [defaultDataset], err => {
              if (err) return console.error(err);
              db.run(`DROP TABLE decisions_old`, () =>
                console.log('✅ decisions migrated')
              );
            });
          });
        });
      }
    });

    // 4) old match_assessments
    db.run(`
      CREATE TABLE IF NOT EXISTS match_assessments (
        assessment_id  INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL,
        case_filename  TEXT    NOT NULL,
        match_index    INTEGER NOT NULL,
        first_file     TEXT    NOT NULL,
        start1_line    INTEGER NOT NULL,
        start1_col     INTEGER NOT NULL,
        end1_line      INTEGER NOT NULL,
        end1_col       INTEGER NOT NULL,
        second_file    TEXT    NOT NULL,
        start2_line    INTEGER NOT NULL,
        start2_col     INTEGER NOT NULL,
        end2_line      INTEGER NOT NULL,
        end2_col       INTEGER NOT NULL,
        level          INTEGER NOT NULL CHECK(level BETWEEN 1 AND 5),
        comment        TEXT,
        timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(user_id),
        UNIQUE(user_id, case_filename, match_index)
      )
    `);

    // 5) migrate match_assessments → add dataset
    db.all(`PRAGMA table_info(match_assessments)`, (e, cols) => {
      if (e) return console.error(e);
      const names = cols.map(c => c.name);
      if (!names.includes('dataset')) {
        console.log('🛠 Migrating match_assessments → adding dataset…');
        db.run(`ALTER TABLE match_assessments RENAME TO match_assessments_old`, err => {
          if (err) return console.error(err);
          db.run(`
            CREATE TABLE match_assessments (
              assessment_id  INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id        INTEGER NOT NULL,
              dataset        TEXT    NOT NULL,
              case_filename  TEXT    NOT NULL,
              match_index    INTEGER NOT NULL,
              first_file     TEXT    NOT NULL,
              start1_line    INTEGER NOT NULL,
              start1_col     INTEGER NOT NULL,
              end1_line      INTEGER NOT NULL,
              end1_col       INTEGER NOT NULL,
              second_file    TEXT    NOT NULL,
              start2_line    INTEGER NOT NULL,
              start2_col     INTEGER NOT NULL,
              end2_line      INTEGER NOT NULL,
              end2_col       INTEGER NOT NULL,
              level          INTEGER NOT NULL CHECK(level BETWEEN 1 AND 5),
              comment        TEXT,
              timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(user_id) REFERENCES users(user_id),
              UNIQUE(user_id, dataset, case_filename, match_index)
            )
          `, err => {
            if (err) return console.error(err);
            const sql = `
              INSERT INTO match_assessments
                (assessment_id,user_id,dataset,case_filename,match_index,
                 first_file,start1_line,start1_col,end1_line,end1_col,
                 second_file,start2_line,start2_col,end2_line,end2_col,
                 level,comment,timestamp)
              SELECT
                assessment_id,
                user_id,
                ?            AS dataset,
                case_filename,
                match_index,
                first_file,
                start1_line,
                start1_col,
                end1_line,
                end1_col,
                second_file,
                start2_line,
                start2_col,
                end2_line,
                end2_col,
                level,
                comment,
                timestamp
              FROM match_assessments_old
            `;
            db.run(sql, [defaultDataset], err => {
              if (err) return console.error(err);
              db.run(`DROP TABLE match_assessments_old`, () =>
                console.log('✅ match_assessments migrated')
              );
            });
          });
        });
      }
    });
  });
});

// ─── API ROUTES ────────────────────────────────────────────────────────────────

// health-check
app.get('/', (req, res) => {
  res.send('Plagiarism Annotation Backend is running!');
});

// register
app.post('/api/register', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  db.run(
    'INSERT INTO users(username) VALUES(?)',
    [username],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed'))
          return res.status(409).json({ error: 'Username taken' });
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ userId: this.lastID, username });
    }
  );
});

// login
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  db.get(
    'SELECT user_id FROM users WHERE username=?',
    [username],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: 'Invalid username' });
      res.json({ userId: row.user_id, username });
    }
  );
});

// list datasets
app.get('/api/datasets', (req, res) => {
  try {
    res.json(listDatasets());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/:dataset/cases', (req, res) => {
  const raw     = req.params.dataset;
  const dataset = findDataset(raw);
  if (!dataset) return res.status(404).json({ error:'Unknown dataset' });

  const dir = path.join(dataRoot, dataset);
  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error:'Dataset folder not found' });
  }

  // 1) collect all .json file paths under `dir`, skipping `files/`:
  const jsonPaths = [];
  (function walk(d) {
    fs.readdirSync(d).forEach(name => {
      const full = path.join(d, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (name === 'files') return; // skip student source files
        walk(full);
      } else if (name.endsWith('.json')) {
        jsonPaths.push(full);
      }
    });
  })(dir);

  console.log(`ℹ️ /api/${raw}/cases → found JSON files:`, jsonPaths.length);

  // 2) parse them and build exactly { filename, similarities }
  const cases = jsonPaths.map(fp => {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch (e) {
      console.error(`❌ Failed to parse ${fp}:`, e.message);
      return null;
    }
    // filename relative to the dataset root, e.g. "subdir/caseA.json" or "caseB.json"
    const filename = path.relative(dir, fp).replace(/\\/g, '/');
    // take the `similarities` field from your JSON (or empty object)
    const similarities = data.similarities || {};
    return { filename, similarities };
  }).filter(x => x !== null);

  console.log(`ℹ️ /api/${raw}/cases → returning ${cases.length} items`);
  // 3) wrap in { cases: [...] } so frontend can do `payload.cases`
  return res.json({ cases });
});

// load a single case JSON
app.get('/api/:dataset/case/:fname', (req, res) => {
  const raw     = req.params.dataset;
  const dataset = findDataset(raw);
  if (!dataset) return res.status(404).json({ error: 'Unknown dataset' });

  const { fname } = req.params;
  if (fname.includes('..') || fname.includes('/'))
    return res.status(400).json({ error: 'Invalid filename' });

  const fp = path.join(dataRoot, dataset, fname);
  console.log(`Attempting to read case file: ${fp}`); // Add logging here
  fs.readFile(fp, 'utf8', (err, txt) => {
    if (err) {
      console.error(`Error reading case file ${fp}: ${err.message}`); // Log error
      if (err.code === 'ENOENT')
        return res.status(404).json({ error: 'Not found' });
      return res.status(500).json({ error: 'Read error' });
    }
    try {
      res.json(JSON.parse(txt));
    } catch (_) {
      res.status(500).json({ error: 'Parse error' });
    }
  });
});

// ─── THIS ROUTE WAS FIXED ──────────────────────────────────────────────────────
// Previously `req.params.filepath` was an Array from path-to-regexp.
// We now join it into a string before calling path.resolve.
app.get('/api/:dataset/file/*filepath', (req, res) => {
  const raw     = req.params.dataset;
  const dataset = findDataset(raw);
  if (!dataset) return res.status(404).send('Unknown dataset');

  let { filepath } = req.params;
  // if wildcard gave us an Array of segments, re-join them:
  if (Array.isArray(filepath)) {
    filepath = filepath.join('/');
  }

  if (filepath.includes('..')) return res.status(400).send('Invalid path');

  const abs = path.resolve(srcRoot, dataset, 'files', filepath);
  console.log('[FILE]', abs, 'exists?', fs.existsSync(abs));
  res.sendFile(abs, err => {
    if (err) {
      if (err.code === 'ENOENT') return res.status(404).send('Not found');
      return res.status(err.status || 500).send(err.message);
    }
  });
});

// get decisions for user/dataset
app.get('/api/:dataset/decisions/:uname', (req, res) => {
  const raw     = req.params.dataset;
  const dataset = findDataset(raw);
  if (!dataset) return res.status(404).json({ error: 'Unknown dataset' });

  db.get(
    'SELECT user_id FROM users WHERE username=?',
    [req.params.uname],
    (e, u) => {
      if (e) return res.status(500).json({ error: e.message });
      if (!u) return res.status(404).json({ error: 'User not found' });
      db.all(
        `SELECT case_filename, level, comment, timestamp
         FROM decisions
         WHERE user_id=? AND dataset=?`,
        [u.user_id, dataset],
        (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          const out = {};
          rows.forEach(r => {
            out[r.case_filename] = {
              level:     r.level,
              comment:   r.comment,
              timestamp: r.timestamp
            };
          });
          res.json(out);
        }
      );
    }
  );
});

// save one decision
app.post('/api/:dataset/decisions/:uname/:fname', (req, res) => {
  const raw     = req.params.dataset;
  const dataset = findDataset(raw);
  if (!dataset) return res.status(404).json({ error: 'Unknown dataset' });

  const { uname, fname } = req.params;
  const { level, comment } = req.body;
  if (typeof level !== 'number' || level < 1 || level > 5)
    return res.status(400).json({ error: 'Invalid level' });
  if (fname.includes('..') || fname.includes('/'))
    return res.status(400).json({ error: 'Invalid filename' });

  db.get('SELECT user_id FROM users WHERE username=?', [uname], (e, u) => {
    if (e) return res.status(500).json({ error: e.message });
    if (!u) return res.status(404).json({ error: 'User not found' });
    const sql = `
      INSERT INTO decisions
        (user_id, dataset, case_filename, level, comment)
      VALUES (?,?,?,?,?)
      ON CONFLICT(user_id,dataset,case_filename) DO UPDATE SET
        level     = excluded.level,
        comment   = excluded.comment,
        timestamp = CURRENT_TIMESTAMP
    `;
    db.run(sql, [u.user_id, dataset, fname, level, comment || null], err => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Decision saved' });
    });
  });
});

// get assessments
app.get('/api/:dataset/assessments/:uname/:fname', (req, res) => {
  const raw     = req.params.dataset;
  const dataset = findDataset(raw);
  if (!dataset) return res.status(404).json({ error: 'Unknown dataset' });

  const { uname, fname } = req.params;
  if (fname.includes('..') || fname.includes('/'))
    return res.status(400).json({ error: 'Invalid filename' });

  db.get('SELECT user_id FROM users WHERE username=?', [uname], (e, u) => {
    if (e) return res.status(500).json({ error: e.message });
    if (!u) return res.status(404).json({ error: 'User not found' });
    db.all(
      `SELECT match_index,
              first_file, start1_line,start1_col,end1_line,end1_col,
              second_file, start2_line,start2_col,end2_line,end2_col,
              level, comment
       FROM match_assessments
       WHERE user_id=? AND dataset=? AND case_filename=?`,
      [u.user_id, dataset, fname],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      }
    );
  });
});

// save assessments
app.post('/api/:dataset/assessments/:uname/:fname', (req, res) => {
  const raw     = req.params.dataset;
  const dataset = findDataset(raw);
  if (!dataset) return res.status(404).json({ error: 'Unknown dataset' });

  const { uname, fname } = req.params;
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
  if (fname.includes('..') || fname.includes('/'))
    return res.status(400).json({ error: 'Invalid filename' });

  db.get('SELECT user_id FROM users WHERE username=?', [uname], (e, u) => {
    if (e) return res.status(500).json({ error: e.message });
    if (!u) return res.status(404).json({ error: 'User not found' });

    // Validate all items before proceeding
    for (const [index, item] of items.entries()) {
      if (item.level == null || typeof item.level !== 'number' || item.level < 1 || item.level > 5) {
        return res.status(400).json({
          error: `Invalid level for assessment item at index ${index}. Level must be a number between 1 and 5.`,
          invalidItem: item
        });
      }
      // Add any other necessary validation for other fields here
    }

    const stmt = db.prepare(`
      INSERT INTO match_assessments
        (user_id,dataset,case_filename,match_index,
         first_file,start1_line,start1_col,end1_line,end1_col,
         second_file,start2_line,start2_col,end2_line,end2_col,
         level,comment)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id,dataset,case_filename,match_index) DO UPDATE SET
        level     = excluded.level,
        comment   = excluded.comment,
        timestamp = CURRENT_TIMESTAMP
    `);

    db.serialize(() => {
      items.forEach(i => {
        stmt.run(
          u.user_id,
          dataset,
          fname,
          i.match_index,
          i.first_file,
          i.start1_line,
          i.start1_col ?? 0,
          i.end1_line,
          i.end1_col ?? 0,
          i.second_file,
          i.start2_line,
          i.start2_col ?? 0,
          i.end2_line,
          i.end2_col ?? 0,
          i.level,
          i.comment || null
        );
      });
      stmt.finalize(err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Assessments saved' });
      });
    });
  });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(port, () => 
  console.log(`⚡️ Listening on http://localhost:${port}`)
);
process.on('SIGINT', () => db.close());
