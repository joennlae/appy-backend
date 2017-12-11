'use strict';

const Bcrypt = require('bcryptjs');
const Chalk = require('chalk');
const GeneratePassword = require('password-generator');
const Q = require('q');

module.exports = function (mongoose) {
  const modelName = "user";
  const Types = mongoose.Schema.Types;
  const Schema = new mongoose.Schema({
    isActive: {
      type: Types.Boolean,
      allowOnUpdate: false,
      default: false
    },
    isEnabled: {
      type: Types.Boolean,
      allowOnUpdate: false,
      default: true
    },
    password: {
      type: Types.String,
      exclude: true,
      allowOnUpdate: false
    },
    pin: {
      type: Types.String,
      exclude: true,
      allowOnUpdate: false
    },
    firstName: {
      type: Types.String,
      required: true
    },
    lastName: {
      type: Types.String,
      required: true
    },
    email: {
      type: Types.String,
      required: true,
      unique: true
    },
    role: {
      type: Types.ObjectId,
      ref: "role"
    },
    resetPassword: {
      hash: {
        type: Types.String
      },
      pinRequired: {
        type: Types.Boolean
      },
      allowOnCreate: false,
      allowOnUpdate: false,
      exclude: true,
      type: Types.Object
    },
    activateAccountHash: {
      allowOnCreate: false,
      allowOnUpdate: false,
      exclude: true,
      type: Types.String
    }
  }, { collection: modelName });

  Schema.statics = {
    collectionName: modelName,
    routeOptions: {
      authorizeDocumentCreator: false,
      associations: {
        role: {
          type: "MANY_ONE",
          model: "role",
          duplicate: [{
            field: 'name'
          }]
        },
        groups: {
          type: "MANY_MANY",
          alias: "group",
          model: "group"
        },
        permissions: {
          type: "MANY_MANY",
          alias: "permission",
          model: "permission",
          linkingModel: "user_permission"
        }
      },
      create: {
        pre: function (payload, request, Log) {

          if (!payload.password) {
            payload.password = GeneratePassword(10, false);
          }
          if (!payload.pin) {
            payload.pin = GeneratePassword(4, false, /\d/);
          }

          const promises = []

          promises.push(mongoose.model('user').generateHash(payload.password, Log));
          promises.push(mongoose.model('user').generateHash(payload.pin, Log));
          return Q.all(promises)
            .then(function (result) {
              payload.password = result[0].hash;
              payload.pin = result[1].hash;
              return payload;
            });
        }
      }
    },

    generateHash: function (key, Log) {

      return Bcrypt.genSalt(10)
        .then(function (salt) {
          return Bcrypt.hash(key, salt);
        })
        .then(function (hash) {
          return { key, hash };
        });
    },

    findByCredentials: function (email, password, Log) {

      const self = this;

      const query = {
        email: email.toLowerCase(),
      };

      let user = {};

      return self.findOne(query).lean()
        .then(function (result) {
          user = result;

          if (!user) {
            return false;
          }

          const source = user.password;

          return Bcrypt.compare(password, source);
        })
        .then(function (passwordMatch) {
          if (passwordMatch) {
            return user;
          }
        });
    }
  };

  return Schema;
};
