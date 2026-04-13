const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  authProvider: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'local'
  },
  appleSubject: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  referrerId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isOfficial: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const ensureAppleAuthSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = User.getTableName();
  const columns = await queryInterface.describeTable(tableName);

  if (!columns.authProvider) {
    await queryInterface.addColumn(tableName, 'authProvider', {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'local'
    });
  }

  if (!columns.appleSubject) {
    await queryInterface.addColumn(tableName, 'appleSubject', {
      type: DataTypes.STRING,
      allowNull: true
    });
  }

  const indexes = await queryInterface.showIndex(tableName);
  const hasAppleSubjectIndex = indexes.some((index) =>
    index.unique && Array.isArray(index.fields) && index.fields.some((field) => field.attribute === 'appleSubject')
  );

  if (!hasAppleSubjectIndex) {
    await queryInterface.addIndex(tableName, ['appleSubject'], {
      unique: true,
      name: 'users_apple_subject_unique'
    });
  }
};

User.ensureAppleAuthSchema = ensureAppleAuthSchema;

module.exports = User;
