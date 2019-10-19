# js-interpreter
一个玩具级别的js解释器(用js实现)

## 这个小玩具是看完王垠的[怎样写一个解释器](https://www.yinwang.org/blog-cn/2012/08/01/interpreter)之后完成的

## 仅根据estree实现
parser太累了,所以利用acorn做parser,(之前babel好像也是利用的acorn做的parser)

## 只实现了大部分的es5语法
虽然还有部分没有实现, 但是根据已有的思路,可以快速的实现了
比如 switch根据已有的for实现就可以很容易实现,类似的还有do-while, while

## 正确性
我自己只做了很简单的测试, 可以看parse-test.js,或者直接clone项目运行下interpreter.js
欢迎来指出我的问题,帮助我这个菜鸟

## 最后

如果觉得我的项目还不错的话 :clap:，就给个 star :star: 鼓励一下吧~

## 欢迎大家来指导和批评,同时希望能认识一些朋友,有兴趣的话可以加我微信: DL0523

