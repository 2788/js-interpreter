var fs = require("fs");

var acorn = require("./acorn.js");
var raw = fs.readFileSync("./parse-test.js");
var ast = acorn.parse(raw.toString(), {
  // onInsertedSemicolon: function() {
  //   console.log("onInsertedSemicolon ---> ", arguments);
  // },
  // onTrailingComma: function() {
  //   console.log("onTrailingComma ---> ", arguments);
  // },
  locations: true,
  ranges: true
  // onToken: function() {
  //   console.log("onToken ---> ", arguments);
  // },
  // onComment: function() {
  //   console.log("onComment ---> ", arguments);
  // }
});

function interp(ast, env) {
  for (let stm of ast.body) {
    interpSingle(stm, env);
    // InterpSingle[stm.type](stm, env)
  }
}

function interpSingle(stm, env) {
  let result, val, leftVal, rightVal, obj, name, f, arguments, params, newObj;
  switch (stm.type) {
    case "Identifier":
      return lookup(stm.name, env);

    case "Literal":
      return stm.value;

    case "ExpressionStatement":
      return interpSingle(stm.expression, env);

    // 特意构造的一个类别, ast里面是BlockStatement,这么做是为了区别函数体语句和普通块级语句
    // 执行这里的时候已经是在新的作用域中了,原因是进入这里必先是由函数调用进来
    case "FunctionBody":
      for (let statement of stm.body) {
        result = interpSingle(statement, env);
        if (env.__end__) {
          break;
        }
      }
      if (env.__return__) return result;
      return undefined;

    // 特意构造的一个类别, ast里面是BlockStatement,这么做是为了区别循环体(for, while等等)和普通块级语句
    // 执行这里的时候已经是在新的作用域中了,原因是进入这里必先是由函数调用进来
    case "LoopBody":
      for (let statement of stm.body) {
        result = interpSingle(statement, env);
        if (env.__end__) {
          break;
        }
        if (env.__continue__) {
          env.__continue__ = false;
          break;
        }
      }
      return result;

    case "BlockStatement": //执行这里的时候还没生成最新的作用域,原因是进入这里是通过 [语句列表] 进来的
      let extEnv = env.extend({}); // 生成新的作用域
      for (let statement of stm.body) {
        result = interpSingle(statement, extEnv);
        if (extEnv.__end__) {
          break;
        }
      }
      return result;

    case "DebuggerStatement":
    case "EmptyStatement":
      return undefined;

    case "WithStatement":
      throw new Error("not support with synax");

    case "ReturnStatement":
      if (!isInFunc(env)) throw new Error("Illegal return statement");
      if (stm.argument.value && stm.argument.value == null) result = null;
      else if (stm.argument !== null && stm.argument.name !== "undefined") {
        result = interpSingle(stm.argument, env); // return statement;
      }

      // env.__parent__ = undefined; // 消除当前scope

      while (env && isInEnvOf(env, "func")) {
        // 终止所有在loop内的语句
        env.__end__ = true;
        env.__return__ = true;
        env = env.__parent__;
      }
      return result;

    case "LabeledStatement":
      throw new Error("not support label synax");

    case "SwitchStatement":
    case "ThrowStatement":
    case "TryStatement":
    case "CatchClause":
    case "WhileStatement":
    case "DoWhileStatement":
    case "ForInStatement":
      // 未实现
      return;

    case "ForStatement":
      if (stm.init != null) {
        interpSingle(stm.init, env);
      }
      noTest = !stm.test ? true : false;
      loopEnv = env.extend({ __end__: false }, "loop");
      stm.body.type = "LoopBody"; // 特殊成处理循环体
      while (noTest || interpSingle(stm.test, env)) {
        result = interpSingle(stm.body, loopEnv); // 添加特殊环境变量__end__用来指示是改变了流程
        if (loopEnv.__end__) {
          break; // for语句中 break;或者此for语句在function里面且for内部使用了return
        }
        interpSingle(stm.update, env);
      }
      return result;

    case "IfStatement":
      if (interpSingle(stm.test, env)) {
        return interpSingle(stm.consequent, env);
      } else if (stm.alternate) {
        return interpSingle(stm.statement, env);
      }
      return undefined;

    case "BreakStatement":
      if (!isInEnvOf(env, "loop")) throw new Error("Illegal break statement");
      while (env && isInEnvOf(env, "loop")) {
        // 终止所有在loop内的语句
        env.__end__ = true;
        env = env.__parent__;
      }
      return;

    case "ContinueStatement":
      if (!isInEnvOf(env, "loop")) throw new Error("Illegal continue statement: no surrounding iteration statement");
      while (env && isInEnvOf(env, "loop")) {
        // 终止所有在loop内的语句
        env.__continue__ = true;
        env = env.__parent__;
      }
      return;

    case "VariableDeclaration":
      for (let d of stm.declarations) {
        interpSingle(d, env);
      }
      return undefined;

    case "VariableDeclarator":
      // pattern没有处理
      return (env[stm.id.name] = interpSingle(stm.init, env));



    case "ThisExpression":
      return lookup("this", env);

    case "ArrayExpression":
      return stm.elements == null ? [] : stm.elements.map(e => interpSingle(e, env));

    case "ObjectExpression":
      obj = {};
      stm.properties.map(p => {
        if (p.kind == "init" && p.computed) obj[interpSingle(p.key, env)] = interpSingle(p.value, env);
        else if (p.kind == "init" && !p.computed) {
          //分别对应{hello:"123"} 和{"hello":"123"} 情况下的 字面量 和 标识符
          obj[p.key.name || p.key.value] = interpSingle(p.value, env);
        } else if (p.kind == "get") {
          Object.defineProperty(obj, p.key.name, {
            get: function () {
              return interpSingle(stm.value, env.extend({}, "func"));
            }
          });
        } else {
          // set 还没想好
          Object.defineProperty(obj, p.key.name, {
            set: function (newValue) {
              let params = { [p.value.params[0].name]: newValue };
              return interpSingle(stm.value, env.extend(params, "func"));
            }
          });
        }
      });
      return obj;

    case "FunctionExpression":
    case "FunctionDeclaration":
      result = function (...args) {
        let fucArguments = []
        let params = { this: this, arguments: fucArguments }

        for (let id of stm.params) {
          params[id.name] = undefined;
        }
        for (let i = 0; i < stm.params.length && i < args.length; i++) {
          fucArguments.push(args[i]);
          params[stm.params[i].name] = args[i];
        }
        stm.body.type = "FunctionBody"
        return interpSingle(stm.body, env.extend(params, "func"));
      };
      if (stm.type == "FunctionDeclaration")
        env[stm.id.name] = result;
      return result


    case "UnaryExpression":
      val = interpSingle(stm.argument, env);
      switch (stm.UnaryOperator) {
        case "-":
          return -val;
        case "+":
          return val;
        case "!":
          return !val;
        case "~":
          return ~val;
        case "typeof":
          return typeof val;
        case "void":
          return void val;
        case "delete":
        // 暂时没有想好
      }

    case "BinaryExpression":
      (leftVal = interpSingle(stm.left, env)), (rightVal = interpSingle(stm.right, env));
      switch (stm.operator) {
        case "==":
          return leftVal == rightVal;
        case "!=":
          return leftVal != rightVal;
        case "===":
          return leftVal === rightVal;
        case "!==":
          return leftVal !== rightVal;
        case "<":
          return leftVal < rightVal;
        case "<=":
          return leftVal <= rightVal;
        case ">":
          return leftVal > rightVal;
        case ">=":
          return leftVal >= rightVal;
        case "<<":
          return leftVal << rightVal;
        case ">>":
          return leftVal >> rightVal;
        case ">>>":
          return leftVal >>> rightVal;
        case "+":
          return leftVal + rightVal;
        case "-":
          return leftVal - rightVal;
        case "/":
          return leftVal / rightVal;
        case "%":
          return leftVal % rightVal;
        case "*":
          return leftVal * rightVal;
        case "|":
          return leftVal | rightVal;
        case "^":
          return leftVal ^ rightVal;
        case "&":
          return leftVal & rightVal;
        case "in":
          return leftVal in rightVal;
        case "instanceof":
          return leftVal instanceof rightVal;
      }

    case "AssignmentExpression":
      //没考虑解构的情况
      val = interpSingle(stm.right, env);

      if (stm.left.type == "Identifier") {
        switch (stm.operator) {
          case "=":
            return assign(stm.left.name, val, env);
          case "+=":
            return assign(stm.left.name, val + interpSingle(stm.left, env), env);
          // ...
        }
      } else {
        let target = interpSingle(stm.left.object, env);
        if (stm.computed) {
          target[interpSingle(stm.left.property, env)] = val;
        } else {
          target[stm.left.property.name] = val;
        }
        return val;
      }

    case "LogicalExpression":
      leftVal = interpSingle(stm.leftm, env);
      rightVal = interpSingle(stm.right, env);
      if (stm.operator == "||") return leftVal || rightVal;
      return leftVal && rightVal;

    case "MemberExpression":
      obj = interpSingle(stm.object, env);
      if (stm.computed) {
        return obj[interpSingle(stm.property, env)];
      } else {
        return obj[stm.property.name];
      }

    case "ConditionalExpression":
      if (interpSingle(stm.test, env)) {
        return interpSingle(stm.consequent, env);
      }
      return interpSingle(stm.alternate, env);

    case "SequenceExpression":
      for (let e of stm.expressions) {
        result = interpSingle(e, env);
      }
      return result;

    case "Patterns":
      // 还未实现
      return;

    case "UpdateExpression":
      if (stm.operator == "++") {
        val = interpSingle(stm.argument, env);
        assign(stm.argument.name, val + 1, env);
        return stm.prefix ? val + 1 : val;
      } else {
        val = interpSingle(stm.argument, env);
        assign(stm.argument.name, val - 1, env);
        return stm.prefix ? val - 1 : val;
      }

    case "NewExpression":
      newObj = {};
    case "CallExpression":
      // 分为两种情况调用, 一种是直接调用, 另一种是通过属性方法

      // 属性方法调用的那个对象
      let object;

      // 函数内部参数
      arguments = [];


      for (let p of stm.arguments) {
        val = interpSingle(p, env);
        arguments.push(val);
      }

      // 属性方法调用
      if (stm.callee.object) {
        // 计算对象, 要在此处计算出对象,
        // 不然 
        // interpSingle(stm.callee, env)直接计算出的function会在有属性调用的时候再去求obj,如果遇到初始化就会再次生成
        // 例如: [1,2,3].map( x = > x) 会生成两次[1,2,3] 
        // 如果字面量的元素还有调用了表达式,或者函数调用影响其他地方的,则会更加跟预期不符合
        object = interpSingle(stm.callee.object, env);
        if (stm.callee.computed) { // a[b]
          f = object[interpSingle(stm.property, env)];
        } else { // a.b
          f = object[stm.callee.property.name];
        }
      } else {
        // 普通调用
        f = interpSingle(stm.callee, env);
      }

      if (f === undefined) {
        throw new Error(`not exist function ${stm.callee.name}`);
      }
      if (typeof f != "function") {
        throw new Error(`${f} is not function`);
      }
      // new 语法
      if (newObj) {
        // 设置原型
        newObj.__proto__ = f.prototype;
        object = newObj
      }
      result = f.apply(object, arguments)
      if (newObj && typeof result != "object") {
        // new语法 在没有return一个对象的时候 会自动创建一个对象
        return newObj;
      }
      return result;

    default:
      throw new Error(`unkwon statement! --> ${stm.type}`)
  }
}


//转换成map
const InterpSingle = {
  "Identifier": function (stm, env) {
    return lookup(stm.name, env);
  },
  "Literal": function (stm, env) {
    return stm.value;
  },
  "ExpressionStatement": function (stm, env) {

  }

}

/**
 * scope也就是env,
 * 会通过特殊变量 `__parent__` 来指向上层作用于,
 * `__end__` 指示 块级流程 结束了,
 * `__continue__` 指示是否 跳过 剩下流程
 * `__return__` 指示 返回 的内容
 */
class Scope {
  constructor(vars, name) {
    let desc = Object.getOwnPropertyDescriptors(vars);
    Object.defineProperties(this, desc);
    this.__name__ = name;
  }
  extend(params, name) {
    let child = new Scope(params, name);
    // let child = new Scope({},name);
    // Object.assign(child, params);
    child.__parent__ = this;
    return child;
  }
}

function lookup(x, env) {
  //存在
  if (Reflect.ownKeys(env).indexOf(x) != -1) {
    return env[x];
  }
  while (env.__parent__) {
    env = env.__parent__;
    //存在
    if (Reflect.ownKeys(env).indexOf(x) != -1) return env[x];
  }
  throw new Error(`${x} is not defined`);
}

// 修改闭包上值
function assign(x, v, env) {
  while (env && env.__parent__) {
    //存在
    if (Reflect.ownKeys(env).indexOf(x) != -1) {
      break;
    }
    env = env.__parent__;
  }
  env[x] = v;
}

function isInFunc(env) {
  while (env) {
    if (env.__name__ == "func") return true;
    env = env.__parent__;
  }
  return false;
}

function isInEnvOf(env, name) {
  while (env) {
    if (env.__name__ == name) return true;
    env = env.__parent__;
  }
  return false;
}

function top(env) {
  while (env.__parent__) {
    env = env.__parent__;
  }
  return env;
}

//类似顶层scope, 顶层环境
let topScope = new Scope(global, "topEnv");
interp(ast, (topScope.this = topScope));
