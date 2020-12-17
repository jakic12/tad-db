# tad-db

Ever wanted to use discord as a database? No? ok...

# Functionality

This library can be used in different ways.

## Integrating into an existing bot

if you have already made a bot, you can initialize the `DatabaseManager` object with your `Client` object and the guild that you want to use as your database

```js
const myBot = new Discord.Client();
const db_manager = new DatabaseManager(myBot, myDatabaseGuild);
```

## Standalone

if you have not made a bot, i made one for u 😃
To set it up:

1. Create a bot in the discord developer portal
2. Create a new server that you want to use as a database
3. Invite the bot to the server as admin
4. Create a file `.env` in the root directory (right next to `bot.js`) and put your bot token inside:

```
TOKEN=your-bot-token-here
```

5. All done, just run the bot using `npm start` and you are good to go.
