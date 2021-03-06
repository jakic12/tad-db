const fetchAll = require("discord-fetch-all");

class DatabaseManager {
  /**
   * Creates a DatabaseManager and binds it to the bot and discord server
   * @param {Client} bot bot instance
   * @param {Guild} guild optional, which server to use as a database
   */
  constructor(bot, guild) {
    this.bot = bot;

    this.guild = guild || bot.guilds.cache.map((e) => e)[0];
    console.log(
      `⇒ DatabaseManager instance made, if u need me, I'll be spamming '${this.guild.name}'`
    );

    this.errorFunct = (reject) => (e) => {
      console.error(e);
      reject(e);
    };

    this.usingDatabase = undefined;
  }

  /**
   * return all matching channels
   * all parameters are optional - all undefined parameters will be ignored
   * @param {String} name the name of the channel
   * @param {String} type channel type
   * @param {Channel} parent parent category
   * @param {Function} overrideFunct customFilter
   */
  findChannels(name, type, parent, overrideFunct) {
    return this.guild.channels.cache
      .filter((c) =>
        overrideFunct
          ? overrideFunct(c)
          : (!name || c.name == name) &&
            (!type || c.type == type) &&
            (!parent || c.parentID == parent.id)
      )
      .array();
  }

  /**
   * return channel by name, returns undefined if not found
   * all parameters are optional - all undefined parameters will be ignored
   * @param {String} name the name of the channel
   * @param {String} type channel type
   * @param {Channel} parent parent category
   */
  findChannel(name, type, parent) {
    return new Promise((resolve, reject) => {
      const matches = this.findChannels(name, type, parent);
      resolve(matches[0]);
    });
  }

  /**
   * get database channel
   * @param {String} name
   * @returns {Channel}
   */
  findDatabase(name) {
    return this.findChannel(name, "category");
  }

  /**
   * get all database channels
   * @returns {Array<Channel>}
   */
  listDatabases() {
    return this.findChannels(undefined, "category");
  }

  /**
   * get all table channels that belong to a database
   * @param {String} name table name
   * @param {Channel} database parent database channel
   * @returns {Array<Channel>}
   */
  findTable(name, database = this.usingDatabase) {
    return this.findChannel(name, "text", database);
  }

  /**
   * get all table channels that belong to a database
   * @param {Channel} database parent database
   * @returns {Array<Channel>}
   */
  listTables(database = this.usingDatabase) {
    return this.findChannels(undefined, "text", database);
  }

  /**
   * creates a discord channel
   * @param {String} name name of the channel
   * @param {String} type channel type
   * @param {Channel} parent parent
   */
  createChannel(name, type, parent) {
    return new Promise((resolve, reject) => {
      this.guild.channels
        .create(name, type ? { type } : undefined)
        .then((channel) => {
          if (parent) {
            channel
              .setParent(parent)
              .then(() => resolve(channel))
              .catch(this.errorFunct(reject));
          } else {
            resolve(channel);
          }
        })
        .catch(this.errorFunct(reject));
    });
  }

  /**
   * use database saves the database to the DatabaseManager instance
   * the saved database is used if there is a null database argument
   * (if you are using a database, you don't have to pass a database argument)
   * @param {String} name
   */
  useDatabase(name) {
    return new Promise(async (resolve, reject) => {
      this.usingDatabase = await this.findDatabase(name);
      if (!this.usingDatabase) {
        reject(`Database '${name}' not found`);
      } else {
        resolve(this.usingDatabase);
      }
    });
  }

  /**
   *
   * @param {String} name
   * @param {Channel} database
   */
  createTable(name, database = this.usingDatabase) {
    return this.createChannel(name, "text", database);
  }

  /**
   *
   * @param {String} name
   */
  createDatabase(name) {
    return this.createChannel(name, "category");
  }

  /**
   * create console channel, if it does not exist
   * @returns console channel object
   */
  createConsoleChannel() {
    return new Promise(async (resolve, reject) => {
      const existing = await this.findChannel("console");
      if (!existing) {
        this.createChannel("console")
          .then(resolve)
          .catch(this.errorFunct(reject));
      } else {
        resolve(existing);
      }
    });
  }

  /**
   * deletes all databases forever :(
   */
  dropAllDatabases() {
    Promise.all(
      this.guild.channels.cache.map((channel) => channel.delete())
    ).then(() => {
      this.createConsoleChannel();
    });
  }

  /**
   * deletes all tables from a database
   * @param {Channel} database
   */
  dropAllTables(database = this.usingDatabase) {
    return new Promise(async (resolve, reject) => {
      const tables = this.listTables(database);

      if (!database || !database.id) {
        this.errorFunct(reject)("database is undefined");
        return;
      }
      Promise.all(tables.map((channel) => channel.delete()))
        .then(() => {
          resolve();
        })
        .catch(this.errorFunct(reject));
    });
  }

  fetchAllDataFromTable(name, database = this.usingDatabase) {
    return new Promise(async (resolve, reject) => {
      if (!database || !database.id) {
        this.errorFunct(reject)("database is undefined");
        return;
      }
      const channel = await this.findTable(name, database);
      try {
        const allMessages = await fetchAll.messages(channel, {
          reverseArray: true,
        });

        const file = JSON.parse(allMessages.join("") || `[]`);
        console.log(file);

        resolve(file);
      } catch (e) {
        this.errorFunct(reject)(e);
      }
    });
  }

  filterDataFromTable(name, filterFunc, database = this.usingDatabase) {
    return new Promise(async (resolve, reject) => {
      const channel = await this.findTable(name);

      const allMessages = await fetchAll.messages(channel, {
        reverseArray: true,
      });
      const file = JSON.parse(allMessages.join("") || `[]`);

      const filtered = file.filter(filterFunc);
      const blocks = this.blockify(JSON.stringify(filtered));

      Promise.all(
        blocks.map((b, i) => {
          allMessages[i].edit(b);
        })
      )
        .then(() => {
          Promise.all(
            allMessages.slice(blocks.length).map((m, i) => {
              m.delete();
            })
          )
            .then(() => resolve())
            .catch(this.errorFunct(reject));
        })
        .catch(this.errorFunct(reject));
    });
  }

  blockify(message, blockLength = 2000) {
    const messages = [];
    for (let i = 0; i < message.length / blockLength; i++) {
      messages.push(message.substring(i * blockLength, (i + 1) * blockLength));
    }

    return messages;
  }

  addRecord(name, entry, database = this.usingDatabase) {
    return new Promise(async (resolve, reject) => {
      if (!database || !database.id) {
        this.errorFunct(reject)("database is undefined");
        return;
      }

      const existing = await this.fetchAllDataFromTable(name, database);
      existing.push(entry);

      const channel = await this.findTable(name, database);

      channel.messages
        .fetch({ limit: 1 })
        .then((messages) => {
          console.log(messages);
          let lastMessage = messages.first();

          const newMessage = (lastMessage || { content: `[]` }).content
            .replace(/\]$/g, `,${entry}]`)
            .replace(/^\[\,/g, `[`);

          const messageBlocks = this.blockify(newMessage);

          if (lastMessage) lastMessage.edit(messageBlocks.shift());

          messageBlocks.map((mes) => {
            channel.send(mes);
          });
        })
        .catch(console.error);
    });
  }
}

module.exports = DatabaseManager;
