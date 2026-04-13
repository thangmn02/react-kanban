// export const data = [
//     {
//       id: 'todo',
//       title: 'To Do',
//       tasks: [
//         {
//           id: 1,
//           title: 'Change charts javascript',
//           description: 'In _variables.scss on line 672 you define $table_variants. Each instance of "color-level" needs to be changed to "shift-color".',
//           assignees: [
//             { name: 'Bonnie Green', avatar: 'https://flowbite.com/application-ui/demo/images/users/bonnie-green.png' },
//             { name: 'Roberta Casas', avatar: 'https://flowbite.com/application-ui/demo/images/users/roberta-casas.png' },
//             { name: 'Michael Gough', avatar: 'https://flowbite.com/application-ui/demo/images/users/michael-gough.png' }
//           ],
//           daysLeft: 5
//         },
//         {
//           id: 2,
//           title: 'Change homepage',
//           description: 'Change homepage for Volt Dashboard.',
//           assignees: [
//             { name: 'Bonnie Green', avatar: 'https://flowbite.com/application-ui/demo/images/users/bonnie-green.png' },
//             { name: 'Roberta Casas', avatar: 'https://flowbite.com/application-ui/demo/images/users/roberta-casas.png' }
//           ],
//           image: 'https://flowbite.com/application-ui/demo/images/kanban/task-4-dark.png',
//           daysLeft: 22
//         },
//         {
//           id: 3,
//           title: 'Update dependencies',
//           description: 'Update all npm packages to their latest stable versions.',
//           assignees: [
//             { name: 'Michael Gough', avatar: 'https://flowbite.com/application-ui/demo/images/users/michael-gough.png' }
//           ],
//           daysLeft: 7
//         }
//       ]
//     },
//     {
//       id: 'in-progress',
//       title: 'In Progress',
//       tasks: [
//         {
//           id: 4,
//           title: 'Redesign tables card',
//           description: 'In _variables.scss on line 672 you define $table_variants. Each instance of "color-level" needs to be changed to "shift-color".',
//           assignees: [
//             { name: 'Bonnie Green', avatar: 'https://flowbite.com/application-ui/demo/images/users/bonnie-green.png' },
//             { name: 'Roberta Casas', avatar: 'https://flowbite.com/application-ui/demo/images/users/roberta-casas.png' }
//           ],
//           image: 'https://flowbite.com/application-ui/demo/images/kanban/task-1-dark.jpg',
//           daysLeft: 9
//         },
//       ]
//     },
//     {
//       id: 'done',
//       title: 'Done',
//       tasks: [
//         {
//           id: 6,
//           title: 'Redesign tables card',
//           description: 'In _variables.scss on line 672 you define $table_variants. Each instance of "color-level" needs to be changed to "shift-color".',
//           assignees: [
//             { name: 'Bonnie Green', avatar: 'https://flowbite.com/application-ui/demo/images/users/bonnie-green.png' },
//             { name: 'Michael Gough', avatar: 'https://flowbite.com/application-ui/demo/images/users/michael-gough.png' }
//           ],
//           image: 'https://flowbite.com/application-ui/demo/images/kanban/task-2-dark.jpg',
//           isDone: true
//         },
//         {
//           id: 7,
//           title: 'Create Javascript elements',
//           description: 'Complete the implementation of dynamic form elements.',
//           assignees: [
//             { name: 'Bonnie Green', avatar: 'https://flowbite.com/application-ui/demo/images/users/bonnie-green.png' }
//           ],
//           isDone: true
//         }
//       ]
//     }
//   ]

/* drag drop list
item = todo
source = 0
destination = 2

1. loop 1 time to find item
2. data.splice(0, 1)
3. data.splice(2, 0, ...)

drag drop task differ list
1. loop 1 find tasks in Column
2. loop Column.task to find task A
3. loop ....
*/


// hash object (hash map)
export const data = {
  columns: ['list1', 'list2', 'list3'],
  list: {
    list1: {
      id: 'list1',
      title: 'List 1',
      tasks: ['task1', 'task2']
    },
    list2: {
      id: 'list2',
      title: 'List 2',
      tasks: ['task3']
    },
    list3: {
      id: 'list3',
      title: 'List 3',
      tasks: ['']
    }
  },
  task: {
    task1: {
      id: 'task1',
      title: 'Task 1'
    },
    task2: {
      id: 'task2',
      title: 'Task 2'
    },
    task3: {
      id: 'task3',
      title: 'Task 3'
    }
  }
}