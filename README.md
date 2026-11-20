# Absurd Opinions Problems

**Live site:** https://favoritedevx.github.io/absurd-opinions-problems/

A gigantic database of humanity's most pointless disagreements, in small cards:
*How many people prefer cereal first over milk first? How many think a hot dog is a sandwich?
How many think they could beat a goose in a fight?*

Each card has an animated split bar, a live counter that ticks as the world population grows,
and two buttons to pick a side. After you vote, the card tells you whether you're with the
majority, and the header keeps your **normie score**.

It's a static site: plain HTML, CSS and JavaScript, with no build step and no dependencies.

## Where the numbers come from

Every card shows one of three labels, and polls and measurements link to their source.

| Label | Meaning |
| --- | --- |
| **Measured** | Real-world usage data or a scientific measurement (StatCounter, a handedness meta-analysis). |
| **Poll** | A published poll (YouGov, Gallup, Marist, Stack Overflow…). Most samples are US or UK adults, and question wording and year vary. When a poll reports both sides, the bar shows the split among people who picked one. |
| **Educated guess** | No reliable data was found. The number is an estimate, labelled as such. |

Right now: **4 measured, 34 polls, 229 educated guesses** (267 topics in total).
Turning guesses into polls is the best way to improve the site.

The live "≈ N people" counter multiplies a card's percentage by an estimated live world
population (about 8.3 billion in mid-2026, growing about 2.2 people per second, from the UN World
Population Prospects 2024 medium projection). It shows what Earth would look like if everyone
answered like the poll. It is an extrapolation, not a headcount.

## Run it locally

Open `index.html` in a browser. To serve it instead:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publish with GitHub Pages

1. Merge this branch into `main`.
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set the source to **Deploy from a branch**, then choose `main` and `/ (root)`.

The `.nojekyll` file makes GitHub serve the files as they are.

## Add or fix an opinion

Everything lives in [`assets/data.js`](assets/data.js). Copy a line and give it a unique id:

```js
// "How many people prefer A over B?"
P('my-id', 'food', 'thing A', 'thing B', 60),

// Any question. *Starred words* get highlighted.
Q('my-id', 'absurd', 'How many people would *fight a swan*?', 'Fight', 'Run', 12),

// A real poll: give both sides with raw, plus the source and link.
Q('my-id', 'food', 'How many people like *olives*?', 'Like', 'Dislike', null,
  S('Pollster (US), 2025', 'https://example.com/poll', { raw: [55, 40] })),
```

Categories: `food`, `life`, `home`, `tech`, `pop`, `manners`, `body`, `beliefs`, `words`,
`travel`, `work`, `money`, `games`, `absurd`.

## Optional: live votes shared by all visitors

Out of the box, your votes stay in your own browser. To show visitor vote counts that refresh
every few seconds for everyone:

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the project's SQL editor and run [`supabase.sql`](supabase.sql).
3. Paste the project URL and the public `anon` key into [`assets/config.js`](assets/config.js).

Each card then shows a thin "Visitors here" bar under the vote buttons. Votes go through a
database function that only accepts `a` or `b` for a valid topic id. There is no spam
protection beyond one vote per topic per browser, so treat those counts as entertainment.

## Files

```
index.html          page shell
assets/style.css    styles (light and dark mode)
assets/data.js      the database of opinions
assets/app.js       cards, filters, voting, live counters
assets/config.js    optional Supabase settings
supabase.sql        optional shared vote counter
```
