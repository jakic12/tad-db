require("dotenv").config();
const DatabaseManager = require("./index");
const Discord = require("discord.js");
const bot = new Discord.Client();
const TOKEN = process.env.TOKEN;
const ADMIN_ROLE = process.env.ADMIN_ROLE;

class DatabaseDiscordBot {
  constructor(TOKEN, ADMIN_ROLE, prefix = "$") {
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

    this.adminRole = ADMIN_ROLE;

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
      help: {
        f: () =>
          `There is little help available with this bot, here is a list of all the commands that u can use:\n\`\`\`\n${this.getAllPossibleCommands(
            this.databaseCommands
          ).join("\n")}\`\`\`\nHave fun :)`,
      },
      using: {
        useNeeded: true,
        f: () => this.dm.usingDatabase,
      },
      eval: {
        adminOnly: true,
        f: (code) => eval(code),
      },
      create: {
        table: { useNeeded: true, f: (name) => this.dm.createTable(name) },
        database: { f: (name) => this.dm.createDatabase(name) },
      },
      add: {
        useNeeded: true,
        record: {
          f: (args) => {
            const split = args.split(" ");
            this.dm.addRecord(split.shift(), split.join(" "));
          },
        },
      },
      fetch: {
        all: {
          data: {
            useNeeded: true,
            f: (name) => JSON.stringify(this.dm.fetchAllDataFromTable(name)),
          },
        },
      },
      json: {
        from: {
          table: {
            useNeeded: true,
            f: (name) => this.dm.fetchAllDataFromTable(name),
          },
        },
      },
      filter: {
        data: {
          from: {
            table: {
              useNeeded: true,
              f: (args) => {
                const split = args.split(" ");
                this.dm.filterDataFromTable(
                  split.shift(),
                  eval(split.join(" "))
                );
              },
            },
          },
        },
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
        tables: {
          f: () =>
            "```\n" +
            this.dm
              .listTables()
              .reduce(
                (state, channel) => state + "\n" + "⤍ " + channel.name,
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
        msg.content
          .replace(/\n/g, "")
          .split(";")
          .forEach((cmd) => {
            if (cmd.startsWith(this.prefix)) {
              this.parseCommand(cmd.replace(this.prefix, ""), msg)
                .then((output) => msg.channel.send(output || `Done.`))
                .catch((e) => {
                  msg.react("😢");
                  msg.channel.send(
                    new Discord.MessageEmbed()
                      .setColor("#e74c3c")
                      .setDescription(e)
                  );
                });
            }
          });
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
  parseCommand(command, msg) {
    return new Promise(async (resolve, reject) => {
      const split_command = command.replace(this.prefix, "").split(" ");

      let commandStack = this.databaseCommands;
      let useNeeded = false;
      let adminOnly = false;
      let commandChain = "";

      // each loop, remove keyword and search it in the command tree
      while (split_command.length > 0) {
        const lastCommand = split_command.shift();
        const newCommandStack = commandStack[lastCommand];
        if (!newCommandStack) {
          reject(
            `Invalid command, possible command suggestions:\n${this.getAllPossibleCommands(
              commandChain
                ? { [`**${commandChain}**`]: commandStack }
                : commandStack
            ).join("\n")}`
          );
        } else {
          if (newCommandStack.useNeeded) {
            useNeeded = true;
          }

          if (newCommandStack.commandOnly) {
            adminOnly = true;
          }

          commandChain += lastCommand + " ";
          commandStack = newCommandStack;
          if (useNeeded && !this.dm.usingDatabase) {
            reject(
              `Database not selected dummy... type **${this.prefix}use database <databaseName>**, to select working database`
            );
            return;
          }

          if (commandStack.f) {
            if (adminOnly) {
              if (!this.adminRole) {
                reject(
                  `This is a admin only command and you have no admin role defined... Yikes.`
                );
                return;
              } else {
                const role = msg.member.roles.cache.find(
                  (r) => r.id === this.adminRole
                );

                if (!role) {
                  msg.react("🚫");
                  reject(`Hold up buster, you're not an admin! Stop that rn.`);
                }
              }
            }

            try {
              const startTime = new Date();
              const commandOut = await commandStack.f(
                (split_command || []).join(" ")
              );
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
    try {
      if (msg.content.indexOf("ping") == 0) {
        msg.channel.send(
          `\`\`\`\n(\\______/)\n( ͡ ͡° ͜ ʖ ͡ ͡°)\n\\╭☞     \\╭☞ POG ${msg.content.replace(
            "ping",
            ""
          )}\n\`\`\``
        );
      }

      this.onMessageListeners.map((g) => g(msg));
    } catch (e) {
      msg.channel.send(`Sorry, I did an autismo, my brain broke...`, e);
    }
  }

  addOnMessage(fnc) {
    this.onMessageListeners.push(fnc);
  }
}

const discordBotInstance = new DatabaseDiscordBot(TOKEN, ADMIN_ROLE);
