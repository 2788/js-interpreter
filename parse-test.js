// 函数声明
function hello(name) {
  var result = 0;
  for (var i = 0; i < 10; i++) {
    // 控制流
    if (i == 2) {
      break
    }
    result += i;
  }
  // 闭包
  return function () {
    return name + world(", duli") + result;
  };
}

// 函数表达式 xx, duli, nihao 1
var world = function (name) {
  return name + ", nihao ";
};

// 应该为 --> 
console.log(hello("xx")("yy"))


function Hello(name, age) {
  this.name = name;
  this.age = age;
}

// 原型添加方法
Hello.prototype.say = function () {
  console.log(this.name, this.age)
  return "success"
}


var h1 = new Hello("xx", 100)

// {name:"xx", age:100}
console.log(h1)

// 打印 xx 100
h1.say()

// 测试原型链
console.log(h1 instanceof Hello)


// 测试注入的内置函数
var arr = new Array(5)
console.log(arr instanceof Array)


var count = 0;
function product() {
  return ++count;
}
// 测试数组字面量
// 测试让内置函数调用解释器创建的函数
// 应该为[1,4,9,16]
console.log([product(), product(), product(), product()].map(function (x) {
  return x * x
}))

// 测试字面量对象
// 应该为{hello:"world", hell2:"world2", hello3:5}
var name = "hello3"
console.log({ "hello": "world", hello2: "world2", [name]: product() }) 