
require("dotenv").config();

const cron = require("node-cron");
const http = require("http");

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("Morning News Bot is running.");

}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


const Parser = require("rss-parser");
const { GoogleGenAI } = require("@google/genai");

const parser = new Parser();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});


// ================================
// GREETINGS
// ================================

const morningGreetings = [
  "🌅 Good morning! Here's your quick look at the biggest stories from yesterday.",
  "☀️ Good morning! Let's catch up on what happened around the world yesterday.",
  "🌍 Morning update! Here are the important stories from yesterday.",
  "📰 Good morning! Here's what you need to know this morning."
];

const eveningGreetings = [
  "🌆 Good evening! Here's your quick update on today's biggest stories.",
  "📰 Evening update! Here are the important stories from today so far.",
  "🌍 Good evening! Let's catch up on what happened today.",
  "🌇 Here's your evening news update with the biggest stories from today."
];


// ================================
// DATE FUNCTIONS
// ================================

function getNigeriaDate(daysOffset = 0) {

  const now = new Date();

  const nigeriaDate = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Africa/Lagos"
    })
  );

  nigeriaDate.setDate(
    nigeriaDate.getDate() + daysOffset
  );

  return nigeriaDate.toISOString().split("T")[0];
}


function getNigeriaYesterday() {
  return getNigeriaDate(-1);
}


function getNigeriaToday() {
  return getNigeriaDate(0);
}


// ================================
// NEWS SOURCES
// ================================

const feeds = {

  nigeria: [
    "https://rss.punchng.com/v1/category/latest_news",
     "https://www.channelstv.com/feed/"
  ],

  world: [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://rss.dw.com/syndication/feeds/VAS_CB_Eng_OurVoice.31791-cb.html"
  ],

  football: [
    "https://feeds.bbci.co.uk/sport/football/rss.xml",
    "https://www.espn.com/espn/rss/soccer/news"
  ],

  technology: [
    "https://feeds.bbci.co.uk/news/technology/rss.xml"
  ],

  economy: [
    "https://feeds.bbci.co.uk/news/business/rss.xml"
  ]

};


// ================================
// GET RSS FEED
// ================================

async function getFeed(url) {

  try {

    const feed = await parser.parseURL(url);

    return feed.items.map((item) => ({

      title: item.title,

      description:
        item.contentSnippet ||
        item.content ||
        item.summary ||
        "",

      date:
        item.isoDate ||
        item.pubDate ||
        "",

      link:
        item.link ||
        ""

    }));

  } catch (error) {

    console.log("Feed error:", url);

    return [];

  }

}


// ================================
// COLLECT NEWS
// ================================

async function collectNews(targetDate) {

  console.log("Researching news...");
  console.log("Target date:", targetDate);

  const results = {};

  for (const category of Object.keys(feeds)) {

    results[category] = [];

    for (const feedUrl of feeds[category]) {

      const articles = await getFeed(feedUrl);

      for (const article of articles) {

        if (!article.date) continue;

        const articleDate = new Date(article.date)
          .toISOString()
          .split("T")[0];

        if (articleDate === targetDate) {

          results[category].push(article);

        }

      }

    }

  }

  return results;

}


// ================================
// CREATE MORNING POST
// ================================

async function createMorningPost(news) {

  console.log("Creating morning post with Gemini...");

  const prompt = `

You are a professional morning news editor.

Today is ${getNigeriaToday()}.

The target news date is ${getNigeriaYesterday()}.

The news below was collected from RSS feeds.

Create a short Facebook morning news briefing about important events that happened yesterday.

IMPORTANT:

- Only use information contained in the supplied news.
- Do not invent facts.
- Do not add stories that are not supplied.
- Select the most important stories.
- Mention the source name when possible.
- Keep the language simple and natural.
- No Markdown.
- No URLs.
- No website addresses.
- No hashtags.
- Maximum 450 words.
- Nigeria News MUST come first.
- Give exactly 2 important Nigeria stories.
- Give exactly 2 World stories.
- Give exactly 2 Football stories.
- Give exactly 2 Technology stories.
- Give exactly 2 Economy/Business stories.

Use exactly this structure:

🌅 Good morning! Here's your quick look at the biggest stories from yesterday.

🇳🇬 NIGERIA NEWS:

2 important Nigeria stories.

🌍 WORLD NEWS:

2 important stories.

⚽ FOOTBALL:

2 important football stories.

💻 TECHNOLOGY:

2 important technology stories.

💰 ECONOMY:

2 important economy/business stories.

End with one short positive morning message.

NEWS DATA:

NIGERIA:
${JSON.stringify(news.nigeria, null, 2)}

WORLD:
${JSON.stringify(news.world, null, 2)}

FOOTBALL:
${JSON.stringify(news.football, null, 2)}

TECHNOLOGY:
${JSON.stringify(news.technology, null, 2)}

ECONOMY:
${JSON.stringify(news.economy, null, 2)}

`;

  return generateWithGemini(prompt);

}


// ================================
// CREATE EVENING POST
// ================================

async function createEveningPost(news) {

  console.log("Creating evening post with Gemini...");

  const prompt = `

You are a professional evening news editor.

Today is ${getNigeriaToday()}.

The news below was collected from RSS feeds.

Create a short Facebook evening news briefing about important events that happened today.

This is an evening update, so focus on stories published or developing during today.

IMPORTANT:

- Only use information contained in the supplied news.
- Do not invent facts.
- Do not add stories that are not supplied.
- Select the most important stories.
- Mention the source name when possible.
- Keep the language simple and natural.
- No Markdown.
- No URLs.
- No website addresses.
- No hashtags.
- Maximum 450 words.
- Give exactly 2 important Nigeria stories.
- Give exactly 2 World stories.
- Give exactly 2 Football stories.
- Give exactly 2 Technology stories.
- Give exactly 2 Economy/Business stories.
- Nigeria News should appear as the 3rd or 4th major section.
- Focus on news from today, not yesterday.

Use this structure:

🌆 Good evening! Here's your quick update on today's biggest stories.

🌍 WORLD NEWS:

2 important stories.

⚽ FOOTBALL:

2 important football stories.

🇳🇬 NIGERIA NEWS:

2 important Nigeria stories.

💻 TECHNOLOGY:

2 important technology stories.

💰 ECONOMY:

2 important economy/business stories.

End with one short positive evening message.

NEWS DATA:

NIGERIA:
${JSON.stringify(news.nigeria, null, 2)}

WORLD:
${JSON.stringify(news.world, null, 2)}

FOOTBALL:
${JSON.stringify(news.football, null, 2)}

TECHNOLOGY:
${JSON.stringify(news.technology, null, 2)}

ECONOMY:
${JSON.stringify(news.economy, null, 2)}

`;

  return generateWithGemini(prompt);

}


// ================================
// GEMINI GENERATOR
// ================================

async function generateWithGemini(prompt) {

  let response;

  for (let attempt = 1; attempt <= 3; attempt++) {

    try {

      console.log(`Gemini attempt ${attempt}/3...`);

      response = await ai.models.generateContent({

        model: "gemini-3.6-flash",

        contents: prompt

      });

      break;

    } catch (error) {

      console.log(
        `Gemini attempt ${attempt} failed:`,
        error.status
      );

      if (attempt === 3) {

        throw error;

      }

      const waitTime = attempt * 10000;

      console.log(
        `Waiting ${waitTime / 1000} seconds before retry...`
      );

      await new Promise((resolve) => {

        setTimeout(resolve, waitTime);

      });

    }

  }

  const post = response.candidates?.[0]?.content?.parts
    ?.filter((part) => part.text)
    .map((part) => part.text)
    .join("")
    .trim();

  if (!post) {

    throw new Error(
      "Gemini returned an empty response."
    );

  }

  return post;

}


// ================================
// POST TO FACEBOOK
// ================================

async function postToFacebook(message) {

  console.log("\nPosting to Facebook...");

  const pageId =
    process.env.FACEBOOK_PAGE_ID;

  const accessToken =
    process.env.FACEBOOK_ACCESS_TOKEN;

  if (!pageId || !accessToken) {

    throw new Error(
      "Facebook Page ID or access token is missing."
    );

  }

  const response = await fetch(

    `https://graph.facebook.com/${pageId}/feed`,

    {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        message: message,

        access_token: accessToken

      })

    }

  );

  const data = await response.json();

  if (!response.ok) {

    throw new Error(
      `Facebook API Error: ${JSON.stringify(data)}`
    );

  }

  console.log(
    "Facebook post successful!"
  );

  console.log(
    "Post ID:",
    data.id
  );

  return data;

}


// ================================
// POST TO WHATSAPP
// ================================


async function postToWhatsApp(message) {

  console.log("\nPosting to WhatsApp Channel...");

  const channelId =
    process.env.WHATSAPP_CHANNEL_ID;

  const token =
    process.env.WHAPI_TOKEN;

  if (!channelId || !token) {

    throw new Error(
      "WhatsApp Channel ID or Whapi token is missing."
    );

  }

  const response = await fetch(
    "https://gate.whapi.cloud/messages/text",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },

      body: JSON.stringify({
        to: channelId,
        body: message
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {

    throw new Error(
      `WhatsApp API Error: ${JSON.stringify(data)}`
    );

  }

  console.log(
    "WhatsApp Channel post successful!"
  );

  console.log(
    "WhatsApp response:",
    data
  );

  return data;
}

// ================================
// MORNING BOT
// ================================

async function runMorningBot() {

  try {

    console.log("\n====================================");
    console.log("MORNING NEWS BOT");
    console.log("====================================");

    const news =
      await collectNews(
        getNigeriaYesterday()
      );

    console.log("\nArticles found:");

    console.log(
      "Nigeria:",
      news.nigeria.length
    );

    console.log(
      "World:",
      news.world.length
    );

    console.log(
      "Football:",
      news.football.length
    );

    console.log(
      "Technology:",
      news.technology.length
    );

    console.log(
      "Economy:",
      news.economy.length
    );

    const post =
      await createMorningPost(news);

    console.log("\n====================================");
    console.log("MORNING FACEBOOK POST");
    console.log("====================================");

    console.log(post);

    await postToFacebook(post);

    await postToWhatsApp(post);

    console.log("\n====================================");
    console.log("MORNING BOT FINISHED");
    console.log("====================================");

  } catch (error) {

    console.error("\nMORNING BOT ERROR:");

    console.error(error);

  }

}


// ================================
// EVENING BOT
// ================================

async function runEveningBot() {

  try {

    console.log("\n====================================");
    console.log("EVENING NEWS BOT");
    console.log("====================================");

    const news =
      await collectNews(
        getNigeriaToday()
      );

    console.log("\nArticles found:");

    console.log(
      "Nigeria:",
      news.nigeria.length
    );

    console.log(
      "World:",
      news.world.length
    );

    console.log(
      "Football:",
      news.football.length
    );

    console.log(
      "Technology:",
      news.technology.length
    );

    console.log(
      "Economy:",
      news.economy.length
    );

    const post =
      await createEveningPost(news);

    console.log("\n====================================");
    console.log("EVENING FACEBOOK POST");
    console.log("====================================");

    console.log(post);

    await postToFacebook(post);

    await postToWhatsApp(post);

    console.log("\n====================================");
    console.log("EVENING BOT FINISHED");
    console.log("====================================");

  } catch (error) {

    console.error("\nEVENING BOT ERROR:");

    console.error(error);

  }

}


// ================================
// 7:00 AM MORNING SCHEDULE
// ================================

cron.schedule("0 7 * * *", () => {

  console.log(
    "7:00 AM Nigeria time. Starting morning news bot..."
  );

  runMorningBot();

}, {

  timezone: "Africa/Lagos"

});


// ================================
// 5:00 PM EVENING SCHEDULE
// ================================

cron.schedule("0 17 * * *", () => {

  console.log(
    "5:00 PM Nigeria time. Starting evening news bot..."
  );

  runEveningBot();

}, {

  timezone: "Africa/Lagos"

});

