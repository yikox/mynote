> 日常 SQL 速查。完整旧笔记已归档到 [MySQL 5.6 课程笔记.md](./SQL基本语法/MySQL%205.6%20课程笔记.md)；归档内容来自 2020 年 MySQL 5.6.19 课程实验，示例和语法边界不能直接当作所有数据库或当前版本的通用规则。

当前语法与行为以 [MySQL 8.4 Reference Manual](https://dev.mysql.com/doc/refman/8.4/en/) 及实际数据库方言为准。跨数据库迁移时，先核对分页、日期函数、标识符引用、自动增长、UPSERT、事务隔离级别和 JSON 等差异。

## 选择与连接

```sql
SELECT id, name
FROM users
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 20;
```

在客户端或命令行先连接目标实例，再确认当前数据库和版本：

```sql
SELECT DATABASE(), VERSION();
USE app_db;
```

## 过滤、聚合与关联

```sql
SELECT department_id, COUNT(*) AS n, AVG(score) AS avg_score
FROM employees
WHERE hired_at >= '2025-01-01'
GROUP BY department_id
HAVING COUNT(*) >= 2;
```

```sql
SELECT o.id, u.name, o.total
FROM orders AS o
JOIN users AS u ON u.id = o.user_id
WHERE o.total > 100;
```

`WHERE` 在分组前过滤行，`HAVING` 在分组后过滤聚合结果；需要保留左表未匹配行时使用 `LEFT JOIN`，并检查一对多关联是否意外放大结果集。

## 插入、更新与删除

```sql
INSERT INTO users (name, status)
VALUES ('Ada', 'active');

UPDATE users
SET status = 'disabled'
WHERE id = 42;

DELETE FROM users
WHERE id = 42;
```

修改或删除前先用相同 `WHERE` 执行 `SELECT`；生产环境避免省略条件。`INSERT ... ON DUPLICATE KEY UPDATE` 是 MySQL 语法，不要当作所有数据库通用的 UPSERT 写法。

## 事务

```sql
START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
-- 发现异常时改用 ROLLBACK;
```

事务能否回滚、默认隔离级别、DDL 是否隐式提交取决于数据库与存储引擎；先查目标系统文档，再决定锁、重试和超时策略。

## 旧课程的使用边界

归档笔记适合回顾关系模型、表约束、CRUD、查询、视图等基础概念；它记录的是 MySQL 5.6.19 与 Navicat for MySQL 的 2020 年实验，个别删除语句未实践。阅读其中的 `LIMIT`、数据类型、函数和 DDL 示例时，按 MySQL 5.6 语境复核，不要直接推断 MySQL 8.4 或 PostgreSQL、SQLite 等系统的行为。
