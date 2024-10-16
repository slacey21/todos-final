const { dbQuery } = require("./db-query");
const bcrypt = require("bcrypt");

module.exports = class PgPersistence {
  constructor(session) {
    this.username = session.username;
  }

  // Returns a Promise that resolves to the todo list with the specified todo list ID.
  // The todo list contains the todos for that list. The todos are not sorted. The Promise
  // resolves to `undefined` if the todo list is not found.
  async loadTodoList(todoListId) {
    const GET_TODOLIST = "SELECT * FROM todolists WHERE id = $1 AND username = $2";
    const GET_TODOS = "SELECT * FROM todos WHERE todolist_id = $1 AND username = $2";

    let todoListResult = dbQuery(GET_TODOLIST, todoListId, this.username);
    let todosResult = dbQuery(GET_TODOS, todoListId, this.username);
    let resultBoth = await Promise.all([todoListResult, todosResult]);

    let todoList = resultBoth[0].rows[0];
    if (!todoList) return undefined;

    todoList.todos = resultBoth[1].rows;
    return todoList;
  }

  // Returns a Promise that resolves to the indicated todo in the indicated todo list. Returns
  // `undefined` if either the todo list or the todo is not found. Note that
  // both IDs must be numeric.
  async loadTodo(todoListId, todoId) {
    const FIND_TODO = `
      SELECT *
      FROM todos
      WHERE todolist_id = $1
      AND id = $2
      AND username = $3
    `;

    let result = await dbQuery(FIND_TODO, todoListId, todoId, this.username);

    return result.rows[0];
  }

  // Are all of the todos in the todo list done? If the todo list has at least
  // one todo and all of its todos are marked as done, then the todo list is
  // done. Otherwise, it is undone.
  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  // Returns a promise that resolves to a sorted list of all the todo lists
  // together with their todos. The list is sorted by completion status and
  // title (case-insensitive). The todos in the list are unsorted.
  async sortedTodoLists() {
    const ALL_TODO_LISTS = "SELECT * FROM todolists WHERE username = $1 ORDER BY LOWER(title) ASC";
    const ALL_TODOS = "SELECT * FROM todos WHERE username = $1";

    let todoListResult = dbQuery(ALL_TODO_LISTS, this.username);
    let todosResult = dbQuery(ALL_TODOS, this.username);
    let result = await Promise.all([todoListResult, todosResult]);

    let allTodoLists = result[0].rows;
    let allTodos = result[1].rows;

    allTodoLists.forEach(todoList => {
      todoList.todos = allTodos.filter(todo => todo.todolist_id === todoList.id);
    });

    return this._partitionTodoLists(allTodoLists);
  }

  // Returns a new list of todo lists partitioned by completion status.
  _partitionTodoLists(todoLists) {
    let undone = [];
    let done = [];

    todoLists.forEach(todoList => {
      if (this.isDoneTodoList(todoList)) {
        done.push(todoList);
      } else {
        undone.push(todoList);
      }
    });

    return undone.concat(done);
  }

  // Returns a Promise that resolves to a sorted array of todos for the given todo list.
  // Todos are sorted by completion status and title (case-insensitive).
  async sortedTodos(todoList) {
    const FIND_TODOS = `
      SELECT * FROM todos
      WHERE todolist_id = $1
      AND username =  $2
      ORDER BY done, LOWER(title) ASC`;

    let result = await dbQuery(FIND_TODOS, todoList.id, this.username);
    
    return result.rows;
  }

  // Does the todo list have any undone todos? Returns true if yes, false if no.
  hasUndoneTodos(todoList) {
    return todoList.todos.some(todo => !todo.done);
  }

  // Returns a Promise that resolves to true if a todo list with the specified
  // title exists in the list of todo lists, false otherwise.
  async existsTodoListTitle(title) {
    const TITLE_EXISTS = "SELECT * FROM todolists WHERE title = $1 AND username = $2";

    let result = await dbQuery(TITLE_EXISTS, title, this.username);
    
    return result.rowCount > 0;
  }

  // searches for ID of given todo list within todo lists. If the list
  // exists, it will delete that list from the todo lists, all the associated todos
  // (handled by foreign key cascade rule), and return a Promise that resolves to true.
  // If the list does not exist, returns a Promise that resolves to false. 
  // Assumes the input ID value is numeric.
  async deleteTodoList(todoListId) {
    const DELETE_TODO_LIST = "DELETE FROM todolists WHERE id = $1 AND username = $2";
    const CHECK_TODOS = "SELECT * FROM todos WHERE todolist_id = $1 AND username = $2";

    let deleteResult = await dbQuery(DELETE_TODO_LIST, todoListId, this.username);
    let confirmResult = await dbQuery(CHECK_TODOS, todoListId, this.username);
    
    return deleteResult.rowCount > 0 && confirmResult.rowCount === 0;
  }

  // adds a todo list to the todolists table with the given title
  // returns a Promise that resolves to true if the todo list was 
  // successfully added, false otherwise.
  async createdTodoList(todoListTitle) {
    const CREATE_TODO_LIST = "INSERT INTO todolists (title, username) VALUES($1, $2)";
    
    try {
      let result = await dbQuery(CREATE_TODO_LIST, todoListTitle, this.username);
      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  // Toggle a todo between the done and not done state. Returns a promise that
  // resolves to `true` on success, `false` if the todo list or todo doesn't
  // exist. The id arguments must both be numeric.
  async toggleTodo(todoListId, todoId) {
    const UPDATE_TODO_STATUS = `
      UPDATE todos
      SET done = NOT done
      WHERE todolist_id = $1
      AND id = $2
      AND username = $3
    `;
    
    let result = await dbQuery(UPDATE_TODO_STATUS, todoListId, todoId, this.username);

    return result.rowCount > 0;
  }

  // Removes the todo within the provided todo list if both exist.
  // Returns a Promise that resolves to true if the targeted todo was deleted, false otherwise.
  // Note that both IDs must be numeric.
  async deleteTodo(todoListId, todoId) {
    const DELETE_TODO = "DELETE FROM todos WHERE todolist_id = $1 AND id = $2 AND username = $3";

    let result = await dbQuery(DELETE_TODO, todoListId, todoId);

    return result.rowCount > 0;
  }

  // Returns a Promise that resolves to true if a todo with the given title
  // was successfully added to the desired todoList
  // Note that the todo list ID must be numeric.
  async addedTodo(todoListId, todoTitle) {
    let ADD_TODO = "INSERT INTO todos (title, todolist_id, username) VALUES ($1, $2, $3)";
    
    let result = await dbQuery(ADD_TODO, todoTitle, todoListId, this.username);

    return result.rowCount === 1;
  }

  // If the given todo list exists, will mark all todos in that list as done
  // and return true. If the todo list does not exist, will return false. Note
  // that the todo list ID must be numeric. Returns a Promise that resolves to 
  // true if all todos for the given todo list were marked as completed;
  async completeAllTodos(todoListId) {
    const MARK_ALL_COMPLETE = "UPDATE todos SET done = TRUE WHERE todolist_id = $1 AND username = $2";
    const NUM_TODOS = "SELECT * FROM todos WHERE todolist_id = $1 AND username = $2";

    let markCompleteResult = dbQuery(MARK_ALL_COMPLETE, todoListId, this.username);
    let numTodosResult = dbQuery(NUM_TODOS, todoListId, this.username);
    let bothResults = await Promise.all([markCompleteResult, numTodosResult]);

    return bothResults[0].rowCount === bothResults[1].rowCount;
  }

  // Finds the desired todo list based off of ID and sets the 
  // new title for that todo list. Returns a Promise that resolves to false
  // if list not found, true if found. ID must be numeric.
  async setTodoListTitle(todoListId, todoListTitle) {
    let SET_TODO_LIST_TITLE = "UPDATE todolists SET title = $1 WHERE id = $2 AND username = $3";

    let result = await dbQuery(SET_TODO_LIST_TITLE, todoListTitle, todoListId, this.username);

    return result.rowCount > 0;
  }

  // Returns `true` if `error` seems to indicate a `UNIQUE` constraint
  // violation, `false` otherwise.
  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

  // Returns a Promise that resolves to true if username and password combine to 
  // identify a legitimate application user, false if either the username or
  // password is false.
  async isValidLogin(username, password) {
    let CHECK_LOGIN_STATUS = "SELECT password FROM users WHERE username = $1";

    let result = await dbQuery(CHECK_LOGIN_STATUS, username);

    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password);
  }
};



