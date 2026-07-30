---
title: SQL基本语法
mathjax: true
date: 2022-01-11 22:11:29
tags: [数据库,SQL] 
categories: 数据库
---


> 这是我在2020年，大三下学习数据库的笔记，用于自我学习和查询，具体介绍了SQL语句的相关用法，均经过实验可以使用，MYSQL版本5.6.19，客户端Navicat for mysql。**注：个别删除语句没有实践**
<!-- more -->

#### 模式介绍

模式在SQL中大概就是一个数据库的意思，一个MySQL数据库，如果说一张表是一个文件的话，那一个模式就是一个文件夹。

对模式的操作语句有，创建，删除

* 创建模式

* 删除模式

> 注：模式的说法只在人大金昌数据库，mysql只有实例，数据库，（表，视图。。。），不予记录了。



-----------------

#### 表

表可以说是我们操作MYSQL的基本单位了，表就像是C语言的结构体数组，我们选择每一列的类型，给每一列赋予一个名字。

创建表：

```sql
CREATE TABLE Student          
(
     Sno   CHAR(9) PRIMARY KEY,        /* 列级完整性约束条件,Sno是主码*/                  
     Sname CHAR(20) UNIQUE,             /* Sname取唯一值*/
     Ssex    CHAR(2),
     Sage   SMALLINT,
     Sdept  CHAR(20)
); 
CREATE TABLE  Course
(
     Cno    CHAR(4) PRIMARY KEY,
     Cname  CHAR(40),            
     Cpno     CHAR(4),               	                      
     Ccredit  SMALLINT,
     FOREIGN KEY (Cpno) REFERENCES  Course(Cno) 
); 
CREATE TABLE  SC
(
    Sno  CHAR(9), 
    Cno  CHAR(4),  
    Grade  SMALLINT,
    PRIMARY KEY (Sno,Cno),  
    /* 主码由两个属性构成，必须作为表级完整性进行定义*/
    FOREIGN KEY (Sno) REFERENCES Student(Sno),
    /* 表级完整性约束条件，Sno是外码，被参照表是Student */
    FOREIGN KEY (Cno)REFERENCES Course(Cno)
    /* 表级完整性约束条件， Cno是外码，被参照表是Course*/
);
```

删除表

```
DROP TABLE <表名>［RESTRICT| CASCADE］;
* RESTRICT：删除表是有限制的。
欲删除的基本表不能被其他表的约束所引用
如果存在依赖该表的对象，则此表不能被删除
* CASCADE：删除该表没有限制。
在删除基本表的同时，相关的依赖对象一起删除 
```

数据类型有如下：

| **数据类型**                   | **含义**                                                     |
| ------------------------------ | ------------------------------------------------------------ |
| CHAR(n),CHARACTER(n)           | 长度为n的定长字符串                                          |
| VARCHAR(n),CHARACTERVARYING(n) | 最大长度为n的变长字符串                                      |
| CLOB                           | 字符串大对象                                                 |
| BLOB                           | 二进制大对象                                                 |
| INT，INTEGER                   | 长整数（4字节）                                              |
| SMALLINT                       | 短整数（2字节）                                              |
| BIGINT                         | 大整数（8字节）                                              |
| NUMERIC(p，d)                  | 定点数，由p位数字（不包括符号、小数点）组成，小数后面有d位数字 |
| DECIMAL(p, d),  DEC(p, d)      | 同NUMERIC                                                    |
| REAL                           | 取决于机器精度的单精度浮点数                                 |
| DOUBLE  PRECISION              | 取决于机器精度的双精度浮点数                                 |
| FLOAT(n)                       | 可选精度的浮点数，精度至少为n位数字                          |
| BOOLEAN                        | 逻辑布尔量                                                   |
| DATE                           | 日期，包含年、月、日，格式为YYYY-MM-DD                       |
| TIME                           | 时间，包含一日的时、分、秒，格式为HH:MM:SS                   |
| TIMESTAMP                      | 时间戳类型                                                   |
| INTERVAL                       | 时间间隔类型                                                 |

修改数据表

```sql
ALTER TABLE <表名>
[ ADD[COLUMN] <新列名> <数据类型> [ 完整性约束 ] ]//子句用于增加新列、新的列级完整性约束条件和新的表级完整性约束条件
[ ADD <表级完整性约束>]
[ DROP [ COLUMN ] <列名> [CASCADE| RESTRICT] ] //子句用于删除表中的列
//如果指定了CASCADE短语，则自动删除引用了该列的其他对象
//如果指定了RESTRICT短语，则如果该列被其他对象引用，关系数据库管理系统将拒绝删除该列
[ DROP CONSTRAINT<完整性约束名>[ RESTRICT | CASCADE ] ]//ALTER COLUMN子句用于修改原有的列定义，包括修改列名和数据类型
[ALTER COLUMN <列名><数据类型> ] //ALTER COLUMN子句用于修改原有的列定义，包括修改列名和数据类型
```

案例：向Student表增加“入学时间”列，其数据类型为日期型

```sql
ALTER TABLE Student ADD S_entrance DATE;
```

**不管基本表中原来是否已有数据，新增加的列一律为空值** 

案例：将年龄的数据类型由字符型（假设原来的数据类型是字符型）改为整数。

```sql
ALTER TABLE Student ALTER COLUMN S_entrance INT;

出现错误如下：
[SQL] ALTER TABLE student ALTER COLUMN S_entrance INT;
[Err] 1064 - You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'INT' at line 1
未解决：
修改为：ALTER TABLE student modify COLUMN S_entrance INT;
板本不同，sql语句有差别，我用的版本alter需要换成modify
```

==如果有数据会怎么样==

存在数字4，我修改成CHAR（1）,成功，

存在字符s,y 等，我修改成INT，失败。

案例：增加课程名称必须取唯一值的约束条件

```sql
ALTER TABLE Course ADD UNIQUE(Cname); 
```



#### 索引

**建立索引的目的：加快查询速度**（有索引时查询比较快->WHERE语句）

* 顺序文件上的索引
* B+树索引（参见爱课程网3.2节动画《B+树的增删改》）
* 散列（hash）索引
* 位图索引

特点：

* B+树索引具有动态平衡的优点 
* HASH索引具有查找速度快的特点

==关系数据库管理系统自动选择合适的索引作为存取路径，用户不必也不能显式地选择索引==

语句格式：

```
CREATE [UNIQUE] [CLUSTER] INDEX <索引名> ON <表名>(<列名>[<次序>]，[<列名>[<次序>] ]…);
<表名>：要建索引的基本表的名字
索引：可以建立在该表的一列或多列上，各列名之间用逗号分隔
<次序>：指定索引值的排列次序，升序：ASC，降序：DESC。缺省值：ASC
UNIQUE：此索引的每一个索引值只对应唯一的数据记录
CLUSTER：表示要建立的索引是聚簇索引
```

==聚簇与否==的介绍：

* 聚簇索引：将数据存储与索引放到了一块，找到索引也就找到了数据 
* 非聚簇索引：将数据存储于索引分开结构，索引结构的叶子节点指向了数据的对应行，通过key_buffer把索引先缓存到内存中，当需要访问数据时（通过索引访问数据），在内存中直接搜索索引，然后通过索引找到磁盘相应数据，这也就是为什么索引不在key buffer命中时，速度慢的原因

案例：为学生-课程数据库中的Student，Course，SC三个表建立索引。Student表按学号升序建唯一索引，Course表按课程号升序建唯一索引，SC表按学号升序和课程号降序建唯一索引

```
CREATE UNIQUE INDEX  Stusno ON Student(Sno);
CREATE UNIQUE INDEX  Coucno ON Course(Cno);
CREATE UNIQUE INDEX  SCno ON SC(Sno ASC,Cno DESC);
```

运行无误

修改索引：

```
ALTER INDEX <旧索引名> RENAME TO <新索引名>
失败，我们的版本是5.6.19，不支持修改索引名
```

案例：将SC表的SCno索引名改为SCSno

```
ALTER INDEX SCno RENAME TO SCSno
```

删除索引

```sql
ALTER TABLE tbl_name DROP INDEX old_index_name
```

-------------------------------

#### 查询语句

##### 查询语句基本模式

```sql
SELECT ALL/DISTINCT 目标表达式
FROM 表名或视图名
WHERE 条件表达式
GROUP BY <列名1> [ HAVING <条件表达式> ] 
ORDER BY <列名2> [ ASC|DESC ] 
```

* SELECT子句：指定要显示的属性列
* FROM子句：指定查询对象（基本表或视图）
* WHERE子句：指定查询条件
* GROUP BY子句：对查询结果按指定列的值分组，该属性列值相等的元组为一个组。通常会在每组中作用聚集函数。
* HAVING短语：只有满足指定条件的组才予以输
* ORDER BY子句：对查询结果表按指定列值的升序或降序排序 

案例1：查询全体学生的学号和姓名（验证）

```sql
SELECT Sno,Sname
FROM Student
```

案例2：查询全部列(验证)

```sql
SELECT Sno,Sname,Ssex,Sage,Sdept
FROM Student；
或者
SELECT *
FROM Student；
```

案例3：查询全体学生姓名及出生年月。（由于我们记录的是年龄，而不是出生年，所以我们用当前的年份减去年龄）

```sql
SELECT Sname,2020-Sage
FROM Student
```

案例4：查询全体学生的姓名、出生年份和所在的院系，要求用小写字母表示系名。

```sql
SELECT Sname,2020-Sage,LOWER(Sdept)
FROM Student
```

LOWER()把列的元素换成小写的字母

```
SELECT Sname,'Year of Birth: ',2014-Sage,LOWER(Sdept)
FROM Student;
```

'Year of Birth: '简介字符串

```
SELECT Sname NAME,'你的生日' BIRTH,2020-Sage BIRTHDAY,LOWER(Sdept) DEPARTMENT
FROM Student;
//在列的后面添加名字可以，作为表的表头输出**支持中文**
SELECT Sname 名字,2020-Sage 出生年份,LOWER(Sdept) 专业
FROM Student;
```

![image-20200307125917603](/image/image-20200307125917603.png)

取消重复的行

* SELECT ALL/DISTINCT 目标表达式
* 如果没有指定DISTINCT关键词，则缺省为ALL 

eg:

```sql
SELECT Sno   FROM SC;
等价于：
SELECT ALL  Sno  FROM SC;
```

去掉重复行的话，就要指定关键字DISTINCT

```sql
SELECT DISTINCT Sno
FROM SC; 
```

##### WHERE关键字

该关键字是用来筛选的，在WHERE后面加条件表达式，选出符合表达式的内容

**注：WHERE后面的条件会应用索引，有索引的查询速度快，对于逻辑表达式来说，AND会的判断是按顺序的，所以请优先把有索引的判断条件放在前面，OR则没有影响**

| 查 询  条 件         | 谓  词                                              |
| -------------------- | --------------------------------------------------- |
| 比  较               | =, >, <, >=, <=, !=, <>, !>, !<; NOT+上述比较运算符 |
| 确定范围             | BETWEEN  AND, NOT  BETWEEN AND                      |
| 确定集合             | IN, NOT  IN                                         |
| 字符匹配             | LIKE, NOT  LIKE                                     |
| 空  值               | IS  NULL, IS  NOT NULL                              |
| 多重条件（逻辑运算） | AND, OR, NOT                                        |

案例5：查询计算机科学系全体学生的名单

```
SELECT Sname
FROM student
WHERE Sdept='CS'
```

案例6：查询年龄在20岁以下的学生姓名

```
SELECT Sname
FROM student
WHERE Sage<20;
```

案例7：查询考试成绩不及格的所有学生的学号

```
SELECT DISTINCT Sno
FROM SC
WHERE Grade<60;
```

###### 范围查询

案例8：查询年龄在20-23岁之间的学生的姓名、系别和年龄

```
SELECT Sname,Sdept,Sage
FROM Student
WHERE Sage BETWEEN 20 AND 23;
```

案例9：查询年龄不在20~23岁之间的学生姓名、系别和年龄

```sql
SELECT Sname,Sdept,Sage
FROM Student
WHERE Sage NOT BETWEEN 20 AND 23;
```

案例10：查询计算机科学系（CS）、数学系（MA）和信息系（IS）学生的姓名和性别。

```mysql
SELECT Sname,Ssex
FROM Student
WHERE Sdept IN('CS','MA','IS');
```

###### 字符串匹配

关键字： LIKE

* % （百分号）  代表任意长度（长度可以为0）的字符串，例如a%b表示以a开头，以b结尾的任意长度的字符串
* _ （下横线）  代表任意单个字符，例如a_b表示以a开头，以b结尾的长度为3的任意字符串

案例11：查询学号为201215121的学生的详细情况。

```mysql
SELECT *
FROM Student
WHERE Sno LIKE '201215121'
```

案例12：查询所有刘性学生的姓名，学号和性别

```mysql
SELECT Sname,Sno,Ssex
FROM Student
WHERE Sname LIKE '刘%';
输出如下:
刘晨	201215122	女
```

案例13：查询姓欧阳的且全名为三个汉字的学生的信息

```mysql
SELECT *
FROM Student
WHERE Sname LIKE '欧阳_';
由于我的表格没有姓欧阳的人，输出为空，为了验证是否正确，我在表格加入欧阳锋和欧阳娜娜两个人
201215126	欧阳锋	男	27	CS	s
201215127	欧阳娜娜	女	23	CS	s
下面运行我的代码：
成功找到欧阳锋：
201215126	欧阳锋	男	27	CS	s
```

转码字符和转义字符的相关用法

1. 什么是转义字符？//转义字符是语言内定的一些符号比如，%，_等，具有特定的含义，特殊的功能？
2. 什么是转码字符？有什么用？//我们在现实使用中有可能也要用到这些字符，转码字符就是可以把转义字符变成普通字符的一个关键字

案例14：查询DB_Design课程的课程号和学分。

```sql
//我们的课程名中存在下划线，但是在SQL语句中，下划线会被定义成通配符，因此我们需要定义转义字符，转义字符的关键字为ESCAPE '/'，这里的/就成功被定义成了转义字符
SELECT Cno,Ccredit
FROM Course
WHERE Cname LIKE 'DB/_Design' ESCAPE '/'
```

案例15：查询以"DB_"开头，且倒数第3个字符为 i的课程的详细情况。

```sql
SELECT *
FROM Course
WHERE Cname LIKE 'DB/_%i__' ESCAPE '/'
```

###### 空值的查询

关键字： IS NULL 或 IS NOT NULL  **“IS” 不能用 “=” 代替**

案例：某些的学号和相应的课程号。学生选修课程后没有参加考试，所以有选课记录，但没 有考试成绩。查询缺少成绩的学生

```sql
SELECT *
FROM SC
WHERE Grade IS NULL
```

###### 多重条件查询

逻辑运算符：AND 和 OR 来连接多个条件表达式 **AND的优先级高，但可以用（）改变优先级**

案例：查询计算机系，年龄在20岁以下的学生的姓名

```sql
SELECT Sname
FROM Student
WHERE Sage < 20 AND Sdept='CS';
```

案例：查询计算机科学系（CS）、数学系（MA）和信息系（IS）学生的姓名和性别。

```sql
使用IN关键字
SELECT Sname,Ssex
FROM Student
WHERE Sdept IN('CS','MA','IS');
使用逻辑运算符
SELECT Sname,Ssex
FROM Student
WHERE Sdept='CS' OR Sdept='MA' OR Sdept='IS';
```

##### 排列

有时候我们需要用到排列，SQL提供了`ORDER BY`关键字

* 可以按照一个或者多个属性列排序
* 升序：ASC；降序：DESC；缺省值则为升序
* 对于空值，排序时显示的次序由具体系统实现来决定

案例：查询选修了3号课程的学生的学号及其成绩，查询结果按分数降序排列。

```sql
SELECT Sno,Grade
FROM SC
WHERE Cno='3'
ORDER BY Grade DESC;
疑问：匹配时我直接用整数为什么也可以
SELECT Sno,Grade
FROM SC
WHERE Cno=3
ORDER BY Grade DESC;
```

##### 聚集函数

* 统计元组个数`COUNT(*)`
* 统计一列中值的个数`COUNT([DISTINCT|ALL] <列名>)`
* 计算一列值的总和`SUM([DISTINCT|ALL] <列名>)`
* 计算一列值的平均值`AVG([DISTINCT|ALL] <列名>)`
* 求一列中的最大值`MAX([DISTINCT|ALL] <列名>);MIN([DISTINCT|ALL] <列名>)`

案例：查询学生总数

```sql
SELECT COUNT(*)
FROM Student;
```

案例：查询选修了课程的学生人数

```sql
SELECT COUNT(DISTINCT Sno)
FROM SC;
```

案例：计算一号课程的学生的平均成绩

```mysql
SELECT AVG(Grade)
FROM SC
WHERE Cno='1';
```

案例：查询选修1号课程的学生最高分数。

```mysql
SELECT MAX(Grade)
FROM SC
WHERE Cno='1';
```

案例：查询学生201215121选修课程的总学分数。

```mysql
SELECT SUM(Ccredit)
FROM SC,Course
WHERE Sno='201215121'AND SC.Cno=Course.Cno
```

GROUP BY 语句：细化聚集函数的作用对象

* 如果未对查询结果分组，聚集函数将作用于整个查询结果
* 对查询结果分组后，聚集函数将分别作用于每个组 
* 按指定的一列或多列值分组，值相等的为一组

案例：求各个课程号及相应的选课人数

```mysql
这里对查询结果分组，这样的话聚集函数作用于每个组
SELECT Cno,COUNT(Sno)
FROM SC
GROUP BY Cno;
输出结果为：
1	1
2	3
3	2
5	1
```

案例：查询选修了三门以上课程的学生学号

```mysql
SELECT Sno
FROM  SC
GROUP BY Sno
HAVING  COUNT(*) >3;      
```

案例：查询平均成绩大于等于90分的学生学号和平均成绩

```mysql
下面的语句是不对的：
SELECT Sno, AVG(Grade)
FROM  SC
WHERE AVG(Grade)>=90
GROUP BY Sno;
因为WHERE子句中是不能用聚集函数作为条件表达式
正确的查询语句应该是：
SELECT  Sno, AVG(Grade)
FROM  SC
GROUP BY Sno
HAVING AVG(Grade)>=90;
```

* HAVING短语与WHERE子句的区别：作用对象不同，WHERE子句作用于基表或视图，从中选择满足条件的元组，HAVING短语作用于组，从中选择满足条件的组。

##### 连接查询

故名知意，涉及两个或两个以上的表的查询

###### 等值与非等值连接查询

* 等值连接：使用连接运算符=

案例：查询每个学生及其选修课程的情况

```sql
SELECT  Student.*, SC.*
FROM     Student, SC
WHERE  Student.Sno = SC.Sno;
```

执行过程(体现不出关系数据库关系的？那还要关系做什么)

> （1）嵌套循环法（NESTED-LOOP）
>
> 首先在表1中找到第一个元组，然后从头开始扫描表2，逐一查找满足连接件的元组，找到后就将表1中的第一个元组与该元组拼接起来，形成结果表中一个元组。
> 		表2全部查找完后，再找表1中第二个元组，然后再从头开始扫描表2，逐一查找满足连接条件的元组，找到后就将表1中的第二个元组与该元组拼接起来，形成结果表中一个元组。
> 		重复上述操作，直到表1中的全部元组都处理完毕
>
> （2）排序合并法（SORT-MERGE）
>
> 常用于=连接
> 		首先按连接属性对表1和表2排序
> 		对表1的第一个元组，从头开始扫描表2，顺序查找满足连接条件的元组，找到后就将表1中的第一个元组与该元组拼接起来，形成结果表中一个元组。当遇到表2中第一条大于表1连接字段值的元组时，对表2的查询不再继续
>
> 找到表1的第二条元组，然后从刚才的中断点处继续顺序扫描表2，查找满足连接条件的元组，找到后就将表1中的第一个元组与该元组拼接起来，形成结果表中一个元组。直接遇到表2中大于表1连接字段值的元组时，对表2的查询不再继续
> 		重复上述操作，直到表1或表2中的全部元组都处理完毕为止 
>
> （3）索引连接（INDEX-JOIN）
>
> 对表2按连接字段建立索引
> 		对表1中的每个元组，依次根据其连接字段值查询表2的索引，从中找到满足条件的元组，找到后就将表1中的第一个元组与该元组拼接起来，形成结果表中一个元组

自然连接

```sql
[例 3.50]  对[例 3.49]用自然连接完成。
 SELECT  Student.Sno,Sname,Ssex,Sage,Sdept,Cno,Grade
 FROM     Student,SC
 WHERE  Student.Sno = SC.Sno;
[例 3.49]  查询每个学生及其选修课程的情况
SELECT  Student.*, SC.*
FROM     Student, SC
WHERE  Student.Sno = SC.Sno;
3.49自己加进来对比的
```

1、自然连接一定是等值连接，等值连接不一定是自然连接。

2、等值连接不把重复的属性去掉，自然连接要把重复的属性去掉。

SQL语句的不同就是 在于 例3.50里没有选择SC里的sno那一列

连接和判断同时存在的情况也是有的，比如

案例：查询选修2号课程且成绩在90分以上的所有学生的学号和姓名。

```sql
SELECT Student.Sno, Sname
FROM     Student, SC
WHERE  Student.Sno=SC.Sno  AND    		               
SC.Cno=' 2 ' AND SC.Grade>90;
```

执行过程：

​	先从SC中挑选出Cno='2'并且Grade>90的元组形成一个中间关系
​			再和Student中满足连接条件的元组进行连接得到最终的结果关系

###### 自身连接

自己和自己连接

需要给表起别名以区别

由于所有属性名都是同名属性，因此必须使用别名前缀

案例：查询每一门课的间接先修课（即先修课的先修课）

```sql
SELECT  FIRST.Cno, SECOND.Cpno
FROM  Course  FIRST, Course  SECOND
WHERE FIRST.Cpno = SECOND.Cno;
```

###### 外连接

区别：普通连接操作只输出满足连接条件的元组,外连接操作以指定表为连接主体，将主体表中不满足连接条件的元组一并输出。

 左外连接：列出左边关系中所有的元组 
 		右外连接：列出右边关系中所有的元组

 案例：改写[例 3.49]

```sql
SELECT Student.Sno,Sname,Ssex,Sage,Sdept,Cno,Grade
FROM  Student  LEFT OUTER JOIN SC 
ON(Student.Sno=SC.Sno); 
```

###### 多表连接

两个以上的表进行连接

案例：查询每个学生的学号、姓名、选修的课程名及成绩

```sql
SELECT Student.Sno, Sname, Cname, Grade
FROM    Student, SC, Course    /*多表连接*/
WHERE Student.Sno = SC.Sno 
AND SC.Cno = Course.Cno;
```

##### 嵌套查询

#### 插入数据

语句格式：

```sql
INSERT
INTO 表名（列名）
VALUES （数据）
```

* INTO 
  * 指定要插入数据的表名及属性列
  * 属性列的顺序可与表定义中的顺序不一致
  * 没有指定属性列：表示要插入的是一条完整的元组，且属性列属性与表定义中的顺序一致
  * 指定部分属性列：插入的元组在其余属性列上取空值

* VALUE

  * 提供的值必须与INTO子句匹配，值的个数和值的类型


案例：插入一条选课记录（ '200215128','1 '）

```sql
INSERT
INTO SC(Sno,Cno)
VALUES ('201215128 ','1');
或者：
INSERT
INTO SC
VALUES (' 201215128 ','1',NULL);
```

插入子查询数据

INSERT 
        INTO <表名>  [(<属性列1> [,<属性列2>…  )]
 	   子查询;

**SELECT子句目标列必须与INTO子句匹配**

```sql
INSERT
INTO  Dept_age(Sdept,Avg_age)
SELECT  Sdept,AVG(Sage)
FROM  Student
GROUP BY Sdept;
```

![image-20200318232659266](/image/image-20200318232659266.png)

**实体的完整性和参照完整性是什么**

#### 修改数据

语句格式：

```sql
UPDATA 表名
SET 列名=表达式，列名=表达式...
WHERE 条件
```
**功能**：修改指定表中满足WHERE子句条件的元组，SET子句给出<表达式>的值用于取代相应的属性列，如果省略WHERE子句，表示要修改表中的所有元组

案例：将学生201215121的年龄改为22岁
```sql
UPDATA Student
SET Sage=22
WHERE Sno='201215121'
```

案例：将计算机科学系全体学生的成绩置零

```sql
UPDATA SC
SET Grade=0
WHERE Sno IN
(SELECT Sno
FROM Student
WHERE Sdept='CS');
```

#### 删除数据

删除指定表中满足WHERE子句条件的元组，语句格式

```sql
DELETE
FROM 表名
WHERE 条件
```

案例：删除学号为201215128的学生记录

```sql
DELETE
FROM Student
WHERE Sno='201215128'
```

案例：删除计算机科学系所有学生的选课记录

```sql
DELETE
FROM  SC
WHERE  Sno  IN
(SELETE  Sno
FROM   Student
WHERE  Sdept= 'CS') ;
```

#### 空值

空值：NULL

没有具体的数据，还没填的数据等各种情况导致的空值

判断空值

```sql
IS NULL
IS NOT NULL
```

不能取空值的情况

* 有NOT NULL约束条件的不能取空值
* 加了UNIQUE限制的属性不能取空值
* 码属性不能取空值（主键）

空值的运算

* 空值与另一个值（包括另一个空值）的算术运算的结果为空值
* 空值与另一个值（包括另一个空值）的比较运算的结果为UNKNOWN。有UNKNOWN后，传统二值（TRUE，FALSE）逻辑就扩展成了三值逻辑

#### 视图

什么是视图？

答：视图是定义好的查询结构，类似于一个定义好的查询函数，每次需要查询相同的数据时方便调用。

建立视图：

```sql
CREATE VIEW 视图名 列名
AS 子查询
WITH  CHECK  OPTION
```

WITH CHECK OPTION:
		答：对视图进行UPDATE，INSERT和DELETE操作时要保证更新、插入或删除的行满足视图定义中的谓词条件（即子查询中的条件表达式）

子查询可以是任意的SELECT语句，是否可以含有ORDER BY子句和DISTINCT短语，则决定具体系统的实现

案例：建立信息系学生的视图。

```sql
CREATE VIEW IS_Student
AS 
SELECT Sno,Sname,Sage
FROM     Student
WHERE  Sdept= 'IS';
```

案例：建立信息系学生的视图，并要求进行修改和插入操作时仍需保证该视图只有信息系的学生 。

```sql
CREATE VIEW IS_Student
AS 
SELECT Sno,Sname,Sage,Sdept
FROM  Student
WHERE  Sdept= 'IS'
WITH CHECK OPTION;
```

对视图插入数据，修改数据，删除数据

```sql
插入数据
insert into is_student(sno,sname,sage,sDept) values('201215138','李思',34,'IS')
修改数据(无用)，201215121，并不是信息系的学生，无法通过该视图修改
update is_student set sname='李勇1' where sno='201215121'
删除数据(无用)，同上
delete from is_student where sno='201215121'
```

基于多个基表的视图

```sql
CREATE VIEW IS_S1(Sno,Sname,Grade)
AS 
SELECT Student.Sno,Sname,Grade
FROM  Student,SC
WHERE  Sdept= 'IS' AND Student.Sno=SC.Sno AND SC.Cno= '1';
```

基于视图的视图

```sql
CREATE VIEW IS_S2
AS
SELECT Sno,Sname,Grade
FROM  IS_S1
WHERE  Grade>=90;
```

案例：建立一个反应出生年月的视图

```sql
CREATE  VIEW BT_S(Sno,Sname,Sbirth)
AS 
SELECT Sno,Sname,2020-Sage
FROM  Student;
```

删除视图

```sql
DROP  VIEW  <视图名>[CASCADE];
#如果该视图上还导出了其他视图，使用CASCADE级联删除语句，把该视图和由它导出的所有视图一起删除 
#删除基表时，由该基表导出的所有视图定义都必须显式地使用DROP VIEW语句删除 
```

**查询视图与查询基本表相同**

[视图](https://blog.csdn.net/chengjianghao/article/details/86477207)



