## 这个小玩具是看完王垠的[怎样写一个解释器](https://www.yinwang.org/blog-cn/2012/08/01/interpreter)之后完成的

## 代码里面有很详细的注释

## 仅根据estree实现
parser太累了,所以利用acorn做parser,(之前babel好像也是利用的acorn做的parser)

## 只实现了大部分的es5语法
虽然还有部分没有实现, 但是根据已有的思路,可以快速的实现了
比如 switch根据已有的for实现就可以很容易实现,类似的还有do-while, while

## 正确性
我自己只做了很简单的测试, 可以看parse-test.js,或者直接clone项目运行下interpreter.js
