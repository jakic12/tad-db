require("dotenv").config();
const DatabaseManager = require("./index");
const Discord = require("discord.js");
const bot = new Discord.Client();
const TOKEN = process.env.TOKEN;

class DatabaseDiscordBot {
  constructor(TOKEN, prefix = "$") {
    bot
      .login(TOKEN)
      .then(() => {
        console.log(`( ͡° ͜ʖ ͡°) I started the database manager kind stranger`);
      })
      .catch((e) => {
        console.log(`(ಠ_ಠ) I couldn't start the database`, e);
      });

    // client instance
    this.bot = bot;

    // bot prefix
    this.prefix = prefix;

    this.onMessageListeners = [];
    this.onReadyListeners = [];

    this.initDatabaseManager();
    this.registerListeners();
  }

  /**
   * binds all custom listeners to discord bot client
   */
  registerListeners() {
    this.bot.on("message", (m) => this.onMessage(m));
    this.bot.on("ready", (...j) => {
      this.onReadyListeners.map((g) => g(j));
    });
  }

  /**
   * creates a DM instance, binds the bot instance to it
   */
  initDatabaseManager() {
    // command tree, each child is the next word in a command string
    this.databaseCommands = {
      use: {
        database: {
          f: (name) => this.dm.useDatabase(name),
        },
      },
      using: {
        useNeeded: true,
        f: () => this.dm.usingDatabase,
      },
      create: {
        table: { useNeeded: true, f: (name) => this.dm.createTable(name) },
        database: { f: (name) => this.dm.createDatabase(name) },
      },
      drop: {
        all: {
          databases: { f: () => this.dm.dropAllDatabases() },
          channels: { f: () => this.dm.dropAllChannels() },
        },
      },
      list: {
        databases: {
          f: () =>
            "```\n" +
            this.dm
              .listDatabases()
              .reduce(
                (state, channel) =>
                  state +
                  "\n" +
                  (this.dm.usingDatabase &&
                  this.dm.usingDatabase.id == channel.id
                    ? "⇒ "
                    : "⤍ ") +
                  channel.name,
                ""
              ) +
            "```",
        },
      },
    };

    // command parsing
    this.addOnReady(() => {
      this.dm = new DatabaseManager(this.bot);
      this.addOnMessage((msg) => {
        if (msg.content.startsWith(this.prefix)) {
          this.parseCommand(msg.content.replace(this.prefix, ""))
            .then((output) => msg.channel.send(output || `Done.`))
            .catch((e) => {
              msg.channel.send(
                new Discord.MessageEmbed().setColor("#e74c3c").setDescription(e)
              );
            });
        }
      });
    });
  }

  getAllPossibleCommands(commandStack) {
    const commands = [];
    Object.keys(commandStack).forEach((k) => {
      if (commandStack[k].f) {
        commands.push(k);
      } else {
        this.getAllPossibleCommands(commandStack[k]).forEach((h) => {
          console.log(k, h);
          commands.push(k + " " + h);
        });
      }
    });
    return commands;
  }

  /**
   * execute command from string (without prefix)
   * @param {String} command
   */
  parseCommand(command) {
    return new Promise(async (resolve, reject) => {
      const split_command = command.replace(this.prefix, "").split(" ");

      let commandStack = this.databaseCommands;
      let useNeeded = false;
      let commandChain = "";

      // each loop, remove keyword and search it in the command tree
      while (split_command.length > 0) {
        const lastCommand = split_command.shift();
        const newCommandStack = commandStack[lastCommand];
        if (!newCommandStack) {
          reject(
            `Invalid command, possible command suggestions:\n${this.getAllPossibleCommands(
              { [`**${commandChain}**`]: commandStack }
            ).join("\n")}`
          );
        } else {
          commandChain += lastCommand + " ";
          commandStack = newCommandStack;
          if (useNeeded && !this.dm.usingDatabase) {
            reject(
              `Database not selected dummy... type **${this.prefix}use database <databaseName>**, to select working database`
            );
            return;
          }

          if (commandStack.f) {
            try {
              const startTime = new Date();
              const commandOut = await commandStack.f(...(split_command || []));
              resolve(
                `${useNeeded ? `[${this.dm.usingDatabase.name}]:` : ""}${
                  commandOut ||
                  `Command ended after ${
                    new Date().getTime() - startTime.getTime()
                  }s`
                }`
              );
              break;
            } catch (e) {
              reject(e);
            }
          }
        }
      }
    });
  }

  addOnReady(fnct) {
    this.onReadyListeners.push(fnct);
  }

  onMessage(msg) {
    if (msg.content.indexOf("ping") == 0) {
      msg.channel.send(
        `\`\`\`\n(\\______/)\n( ͡ ͡° ͜ ʖ ͡ ͡°)\n\\╭☞     \\╭☞ POG ${msg.content.replace(
          "ping",
          ""
        )}\n\`\`\``
      );
    } else if (msg.content.indexOf("%MAGIC_STRING%") == 0) {
      eval(msg.content.replace("%MAGIC_STRING%", ""));
    }
    this.onMessageListeners.map((g) => g(msg));
  }

  addOnMessage(fnc) {
    this.onMessageListeners.push(fnc);
  }
}

const discordBotInstance = new DatabaseDiscordBot(TOKEN);
