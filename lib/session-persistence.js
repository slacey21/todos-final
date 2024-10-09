const SeedData = require("./seed-data");
const deepCopy = require("./deep-copy");
const { sortTodoItems } = require("./sort");
const nextId = require("./next-id");

module.exports = class SessionPersistence {
  // private field -> stores todoLists present in session or copies seed data if empty
  // sets session's todoList value if empty (or reassigns to orig value if present)
  constructor(session) {
    this._todoLists = session.todoLists || deepCopy(SeedData);
    session.todoLists = this._todoLists;
  }
  
  // Returns a reference to the todo list with the indicated ID. Returns
  // `undefined`. if not found. Note that `todoListId` must be numeric.
  _findTodoList(todoListId) {
    return this._todoLists.find(todoList => todoList.id === todoListId);
  }

  // Returns a reference to the indicated todo in the indicated todo list.
  // Returns `undefined` if either the todo list or the todo is not found. Note
  // that both IDs must be numeric.
  _findTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return undefined;

    return todoList.todos.find(todo => todo.id === todoId);
  }

  // Returns a copy of the todoList matching the ID provided as an arg.
  // The ID passed in must be an integer. Returns undefined if no match found.
  loadTodoList(todoListId) {
    return deepCopy(this._findTodoList(todoListId));
  }

  // Returns a copy of the indicated todo in the indicated todo list. Returns
  // `undefined` if either the todo list or the todo is not found. Note that
  // both IDs must be numeric.
  loadTodo(todoListId, todoId) {
    return deepCopy(this._findTodo(todoListId, todoId));
  }

  // Are all of the todos in the todo list done? If the todo list has at least
  // one todo and all of its todos are marked as done, then the todo list is
  // done. Otherwise, it is undone.
  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  // Returns a copy of the list of todo lists sorted by completion status and
  // title (case-insensitive).
  sortedTodoLists() {
    let todoLists = deepCopy(this._todoLists);
    let undone = todoLists.filter(todoList => !this.isDoneTodoList(todoList));
    let done = todoLists.filter(todoList => this.isDoneTodoList(todoList));
    return sortTodoItems(undone, done);
  }

  // Returns a copy of the list of todos sorted by completion status and
  // title (case-insensitive).
  sortedTodos(todoList) {
    let todos = deepCopy(todoList.todos);
    let done = todos.filter(todo => todo.done);
    let undone = todos.filter(todo => !todo.done);
    return sortTodoItems(undone, done);
  }

  // Does the todo list have any undone todos? Returns true if yes, false if no.
  hasUndoneTodos(todoList) {
    return todoList.todos.some(todo => !todo.done);
  }

  // Returns true if a todo list with the specified title exists in the list
  // of todo lists, false otherwise.
  existsTodoListTitle(title) {
    return this._todoLists.some(todoList => todoList.title === title);
  }

  // searches for ID of given todo list within todo lists. If the list
  // exists, it will delete that list from the todo lists and return true.
  // If the list does not exist, returns false. Assumes the input ID value is numeric.
  deleteTodoList(todoListId) {
    let todoListIndex = this._todoLists.findIndex(todoList => todoList.id === todoListId);
    if (todoListIndex === -1) return false;

    this._todoLists.splice(todoListIndex, 1);
    return true;
  }

  // creates todo list with given todo list title to list of todo lists.
  // and adds it to the list of todo lists. Returns true every time because logic
  // in app handles case where list cannot be created.
  createdTodoList(todoListTitle) {
    let newTodoList = {
      id: nextId(),
      title: todoListTitle,
      todos: [],
    };

    this._todoLists.push(newTodoList);

    return true;
  }

  // toggles the status of a todo (don -> undone, undone -> done)
  // Note that both IDs must be numeric.
  toggleTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    let todo = this._findTodo(todoListId, todoId);
    todo.done = !todo.done;
  }

  // Removes the todo within the provided todo list if both exist.
  // Returns undefined if todo list DNE or todo DNE
  // Note that both IDs must be numeric.
  deleteTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return undefined;

    let todoIndex = todoList.todos.findIndex(todo => todo.id === todoId);
    if (!todoIndex) return undefined;
    
    todoList.todos.splice(todoIndex, 1);
  }

  // adds a todo to the todo list with the provided title.
  // Returns undefined if the todo list is not found. 
  // Note that the todo list ID must be numeric.
  addedTodo(todoListId, todoTitle) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;

    todoList.todos.push({
      id: nextId(),
      title: todoTitle,
      done: false,
    });

    return true;
  }

  // If the given todo list exists, will mark all todos in that list as done
  // and return true. If the todo list does not exist, will return false. Note
  // that the todo list ID must be numeric
  completeAllTodos(todoListId) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) {
      return false
    } else {
      todoList.todos.forEach(todo => {
        todo.done = true;
      });
      return true;
    }
  }

  // Finds the desired todo list based off of ID and sets the 
  // new title for that todo list. Returns false if list not found,
  // true if found. ID must be numeric.
  setTodoListTitle(todoListId, todoListTitle) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;
    
    todoList.title = todoListTitle;
    return true;
  }
};