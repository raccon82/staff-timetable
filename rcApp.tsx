warning: in the working copy of 'src/App.tsx', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/src/App.tsx b/src/App.tsx[m
[1mindex 1312f91..0a383c0 100644[m
[1m--- a/src/App.tsx[m
[1m+++ b/src/App.tsx[m
[36m@@ -68,19 +68,8 @@[m [mfunction App() {[m
   const [viewType, setViewType] = useState<ViewType>('Student');[m
   const [selectedEntityId, setSelectedEntityId] = useState<string>('1'); // Default to first class[m
   [m
[31m-  // State for Staff (Lecturers)[m
[31m-  const [staff, setStaff] = useState<Staff[]>([[m
[31m-    { id: '1', name: 'Andrew Lim' },[m
[31m-    { id: '2', name: 'Jayna' },[m
[31m-    { id: '3', name: 'Thegimin' },[m
[31m-    { id: '4', name: 'David' },[m
[31m-    { id: '5', name: 'Boonkeng' },[m
[31m-    { id: '6', name: 'Josepth' },[m
[31m-    { id: '7', name: 'roy' },[m
[31m-    { id: '8', name: 'Teo' },[m
[31m-    { id: '9', name: 'Prakash' },[m
[31m-    { id: '10', name: 'Joan' },[m
[31m-  ]);[m
[32m+[m[32m  // State for Staff (Lecturers) - starts empty; lecturers are added via the Resources tab[m
[32m+[m[32m  const [staff, setStaff] = useState<Staff[]>([]);[m
   const [schedule, setSchedule] = useState<Schedule>({});[m
   const [newStaffName, setNewStaffName] = useState('');[m
   const [filterText, setFilterText] = useState('');[m
