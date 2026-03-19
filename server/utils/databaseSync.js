const USER_UNIQUE_COLUMNS = ['name', 'email'];

const getDatabaseSyncMode = () => (process.env.DB_SYNC_MODE || 'safe').trim().toLowerCase();

const getDatabaseSyncOptions = () => {
  const syncMode = getDatabaseSyncMode();

  if (syncMode === 'alter') {
    return { alter: true };
  }

  if (syncMode === 'force') {
    return { force: true };
  }

  return {};
};

const isMissingTableError = (error) => {
  const code = error?.original?.code || error?.parent?.code || error?.code;
  const message = error?.message || '';

  return code === 'ER_NO_SUCH_TABLE'
    || code === 'ER_BAD_TABLE_ERROR'
    || /doesn't exist/i.test(message)
    || /unknown table/i.test(message);
};

const cleanupDuplicateUserUniqueIndexes = async (sequelize) => {
  if (sequelize.getDialect() !== 'mysql') {
    return [];
  }

  try {
    const [rows] = await sequelize.query('SHOW INDEX FROM `Users`');
    const queryInterface = sequelize.getQueryInterface();
    const indexesToRemove = [];

    for (const columnName of USER_UNIQUE_COLUMNS) {
      const uniqueKeys = Array.from(new Set(
        rows
          .filter((row) => row.Column_name === columnName && row.Non_unique === 0 && row.Key_name !== 'PRIMARY' && Number(row.Seq_in_index) === 1)
          .map((row) => row.Key_name)
      ));

      if (uniqueKeys.length <= 1) {
        continue;
      }

      const preferredKey = uniqueKeys.includes(columnName) ? columnName : uniqueKeys[0];
      indexesToRemove.push(...uniqueKeys.filter((keyName) => keyName !== preferredKey));
    }

    for (const keyName of indexesToRemove) {
      await queryInterface.removeIndex('Users', keyName);
    }

    return indexesToRemove;
  } catch (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    throw error;
  }
};

module.exports = {
  cleanupDuplicateUserUniqueIndexes,
  getDatabaseSyncMode,
  getDatabaseSyncOptions
};