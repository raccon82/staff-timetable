import React, { useState, useMemo, useEffect, useRef } from 'react';
import './App.css';

type ShiftType = 'Morning' | 'Afternoon' | 'Night' | 'Off' | 'None';
type Tab = 'timetables' | 'resources' | 'modules' | 'activities' | 'rules';
type ModuleType = 'Theory' | 'Practical';

interface Staff {
  id: string;
  name: string;
}

interface LocationItem {
  id: string;
  name: string;
}

interface StudentClass {
  id: string;
  name: string;
}

interface ModuleItem {
  id: string;
  code: string;
  name: string;
  studentClasses: string[];
  type: ModuleType;
  hours: number;
  teachers: string[];
}

interface Schedule {
  [staffId: string]: {
    [day: string]: ShiftType;
  };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM',
  '2:00 PM', '3:00 PM', '4:00 PM'
];
// Print uses 10 separate hourly columns (8:00 AM - 5:00 PM), each its own column.
const PRINT_TIME_SLOTS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM',
  '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
];
const SHIFT_TYPES: ShiftType[] = ['Morning', 'Afternoon', 'Night', 'Off'];

interface ActivityItem {
  id: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  day: string;
  startTime: string;
  duration: string;
  studentClasses: string[];
  teachers: string[];
  locationName: string;
}

type ViewType = 'Student' | 'Staff' | 'Location';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('activities');
  const [viewType, setViewType] = useState<ViewType>('Student');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('1'); // Default to first class
  
  // State for Staff (Lecturers) - starts empty; lecturers are added via the Resources tab
  const [staff, setStaff] = useState<Staff[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({});
  const [newStaffName, setNewStaffName] = useState('');
  const [filterText, setFilterText] = useState('');

  // State for Locations (Labs & Rooms)
  const [locations, setLocations] = useState<LocationItem[]>([
    { id: '1', name: 'T03-13' },
    { id: '2', name: 'B05-10' },
    { id: '3', name: 'T03-23' },
    { id: '4', name: 'T03-21' },
    { id: '5', name: 'T03-19' },
    { id: '6', name: 'T03-22' },
    { id: '7', name: 'T03-12' },
    { id: '8', name: 'T03-09' },
  ]);
  const [newLocationName, setNewLocationName] = useState('');

  // State for Student Classes
  const [studentClasses, setStudentClasses] = useState<StudentClass[]>([
    { id: '1', name: 'PC2401W' },
    { id: '2', name: 'PC2401T' },
    { id: '3', name: 'PC2501M' },
    { id: '4', name: 'PC2501L' },
    { id: '5', name: 'PC2501K' },
    { id: '6', name: 'PC2501J' },
    { id: '7', name: 'PC2601D' },
    { id: '8', name: 'PC2601C' },
    { id: '9', name: 'PC2601B' },
    { id: '10', name: 'PC2601A' },
  ]);
  const [newStudentClassName, setNewStudentClassName] = useState('');

  // State for Modules
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [newModuleCode, setNewModuleCode] = useState('');
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<ModuleType>('Theory');
  const [newModuleHours, setNewModuleHours] = useState<string>('0');
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);

  // State for Activities
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [schedulingErrors, setSchedulingErrors] = useState<string[]>([]);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [newActivityModule, setNewActivityModule] = useState('');
  const [newActivityTeachers, setNewActivityTeachers] = useState<string[]>([]);
  const [newActivityDay, setNewActivityDay] = useState<string | null>(null);
  const [newActivityTime, setNewActivityTime] = useState<string | null>(null);
  const [newActivityDuration, setNewActivityDuration] = useState('1 hr');
  const [newActivityCount, setNewActivityCount] = useState(1);
  const [newActivityLocation, setNewActivityLocation] = useState('');

  // State for Rules
  const [hblDays, setHblDays] = useState<string[]>([]);
  // Per-staff Home-Based Learning days: staffId -> list of HBL days
  const [staffHbl, setStaffHbl] = useState<{ [staffId: string]: string[] }>({});
  const [locationAvailability, setLocationAvailability] = useState<{ [locationId: string]: { [day: string]: 'Free' | 'Restricted' } }>({});

  const toggleHblDay = (day: string) => {
    setHblDays(prev => {
      const isAdding = !prev.includes(day);
      const next = isAdding ? [...prev, day] : prev.filter(d => d !== day);
      // Keep the per-staff HBL matrix in sync: when a global HBL day is
      // turned on, block ALL staff on that day; when turned off, unblock all.
      setStaffHbl(prevStaff => {
        const synced = { ...prevStaff };
        staff.forEach(s => {
          const current = synced[s.id] || [];
          if (isAdding) {
            if (!current.includes(day)) synced[s.id] = [...current, day];
          } else {
            synced[s.id] = current.filter(d => d !== day);
          }
        });
        return synced;
      });
      return next;
    });
  };

  // Toggle a single staff member's HBL on a specific day
  const toggleStaffHbl = (staffId: string, day: string) => {
    setStaffHbl(prev => {
      const current = prev[staffId] || [];
      return {
        ...prev,
        [staffId]: current.includes(day) ? current.filter(d => d !== day) : [...current, day]
      };
    });
  };

  // Select / deselect ALL staff for a given HBL day
  const setAllStaffHbl = (day: string, value: boolean) => {
    setStaffHbl(prev => {
      const next = { ...prev };
      staff.forEach(s => {
        const current = next[s.id] || [];
        if (value) {
          if (!current.includes(day)) next[s.id] = [...current, day];
        } else {
          next[s.id] = current.filter(d => d !== day);
        }
      });
      return next;
    });
  };

  // Select / deselect ALL days for a given staff member
  const setAllDaysForStaff = (staffId: string, value: boolean) => {
    setStaffHbl(prev => {
      const next = { ...prev };
      next[staffId] = value ? DAYS.slice(0, 5) : [];
      return next;
    });
  };

  // Skip the very first render so we don't rebuild on mount.
  const isFirstHblRender = useRef(true);
  // Whenever HBL settings change, silently rebuild the timetable so activities
  // move to the staff's newly available days (and off their new HBL days).
  useEffect(() => {
    if (isFirstHblRender.current) {
      isFirstHblRender.current = false;
      return;
    }
    rebuildTimetable(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffHbl, hblDays]);

  const toggleLocationAvailability = (locationId: string, day: string) => {
    setLocationAvailability(prev => {
      const current = prev[locationId]?.[day] || 'Free';
      return {
        ...prev,
        [locationId]: {
          ...(prev[locationId] || {}),
          [day]: current === 'Free' ? 'Restricted' : 'Free'
        }
      };
    });
  };

  const saveRules = () => {
    // For now just show a confirmation
    alert('Rules saved successfully!');
  };

  const filteredStaff = useMemo(() => {
    return staff.filter(s => s.name.toLowerCase().includes(filterText.toLowerCase()));
  }, [staff, filterText]);

  // Handlers for Staff
  const addStaff = () => {
    if (newStaffName.trim()) {
      const newMember: Staff = {
        id: Math.random().toString(36).substr(2, 9),
        name: newStaffName.trim(),
      };
      setStaff([...staff, newMember]);
      setNewStaffName('');
    }
  };

  const removeStaff = (id: string) => {
    setStaff(staff.filter(s => s.id !== id));
    const newSchedule = { ...schedule };
    delete newSchedule[id];
    setSchedule(newSchedule);
  };

  // Handlers for Locations
  const addLocation = () => {
    if (newLocationName.trim()) {
      const newItem: LocationItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: newLocationName.trim(),
      };
      setLocations([...locations, newItem]);
      setNewLocationName('');
    }
  };

  const removeLocation = (id: string) => {
    setLocations(locations.filter(l => l.id !== id));
  };

  // Handlers for Student Classes
  const addStudentClass = () => {
    if (newStudentClassName.trim()) {
      const newItem: StudentClass = {
        id: Math.random().toString(36).substr(2, 9),
        name: newStudentClassName.trim(),
      };
      setStudentClasses([...studentClasses, newItem]);
      setNewStudentClassName('');
    }
  };

  const removeStudentClass = (id: string) => {
    setStudentClasses(studentClasses.filter(c => c.id !== id));
  };

  // Handlers for Modules
  const addModule = () => {
    const missing = [];
    if (!newModuleCode.trim()) missing.push("Module Code");
    if (!newModuleTitle.trim()) missing.push("Module Title");
    if (selectedClasses.length === 0) missing.push("Student Classes");
    if (!newModuleHours || newModuleHours === '0') missing.push("Hours");
    if (selectedTeachers.length === 0) missing.push("Teachers");

    if (missing.length > 0) {
      alert(`Missing parameters: ${missing.join(', ')}. Please fill in all fields.`);
      return;
    }

    const newModules: ModuleItem[] = selectedClasses.map(className => ({
      id: Math.random().toString(36).substr(2, 9),
      code: newModuleCode.trim(),
      name: newModuleTitle.trim(),
      studentClasses: [className],
      type: selectedType,
      hours: Number(newModuleHours),
      teachers: selectedTeachers,
    }));
    setModules([...modules, ...newModules]);
    setNewModuleCode('');
    setNewModuleTitle('');
    setSelectedClasses([]);
    setSelectedType('Theory');
    setNewModuleHours('0');
    setSelectedTeachers([]);
  };

  const toggleStudentClass = (className: string) => {
    setSelectedClasses(prev => 
      prev.includes(className) 
        ? prev.filter(c => c !== className)
        : [...prev, className]
    );
  };

  const toggleTeacher = (teacherName: string) => {
    setSelectedTeachers(prev => {
      if (prev.includes(teacherName)) {
        return prev.filter(t => t !== teacherName);
      }
      if (prev.length < 4) {
        return [...prev, teacherName];
      }
      return prev;
    });
  };

  const clearActivities = () => {
    if (confirm('Are you sure you want to clear all activities?')) {
      setActivities([]);
    }
  };

  const calculateEndTime = (startTime: string, duration: string) => {
    if (!startTime || startTime === 'No time' || !startTime.includes(' ')) {
      return '';
    }
    try {
      const [time, period] = startTime.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      const durationHours = parseInt(duration);
      hours += durationHours;
      
      const endPeriod = hours >= 12 ? 'PM' : 'AM';
      let endHours = hours % 12;
      if (endHours === 0) endHours = 12;
      
      return `${endHours}:${minutes.toString().padStart(2, '0')} ${endPeriod}`;
    } catch (e) {
      return '';
    }
  };

  const getSlotContent = (day: string, slot: string) => {
    // Find activity for current view
    const currentEntity = viewType === 'Student' 
      ? studentClasses.find(c => c.id === selectedEntityId)?.name 
      : viewType === 'Staff' 
        ? staff.find(s => s.id === selectedEntityId)?.name 
        : locations.find(l => l.id === selectedEntityId)?.name;

    if (!currentEntity) return null;

    const activity = activities.find(a => {
      if (a.day !== day) return false;
      if (!a.startTime || a.startTime === 'No time') return false;
      
      // Match entity based on view
      const entityMatch = (viewType === 'Student' && a.studentClasses.includes(currentEntity)) ||
                          (viewType === 'Staff' && a.teachers.includes(currentEntity)) ||
                          (viewType === 'Location' && a.locationName === currentEntity);
      
      if (!entityMatch) return false;

      // Check time overlap
      const slotTime = parseTime(slot);
      const activityStart = parseTime(a.startTime);
      const activityEnd = activityStart + parseInt(a.duration) * 60;
      
      return slotTime >= activityStart && slotTime < activityEnd;
    });

    if (activity) {
      const mod = modules.find(m => m.id === activity.moduleId);
      const typeShort = mod?.type === 'Theory' ? 'THY' : 'PRA';
      return { 
        type: 'activity', 
        label: activity.moduleName, 
        extra: typeShort,
        activity 
      };
    }

    return null;
  };

  const parseTime = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(' ')) return 0;
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  // Checks that a staff member has at least one full 1-hour break in the
  // 11:00 AM - 2:00 PM lunch window (11-12, 12-1, or 1-2), considering all
  // their scheduled activities on that day plus an optional candidate activity.
  const hasLunchBreak = (teacherName: string, day: string, candidate: any, activityList: ActivityItem[]) => {
    const windows = [
      [parseTime('11:00 AM'), parseTime('12:00 PM')],
      [parseTime('12:00 PM'), parseTime('1:00 PM')],
      [parseTime('1:00 PM'), parseTime('2:00 PM')],
    ];

    const relevant = activityList.filter(a =>
      a.day === day && a.startTime !== 'No time' && a.teachers.includes(teacherName)
    );
    if (candidate && candidate.day === day && candidate.startTime !== 'No time' && candidate.teachers.includes(teacherName)) {
      relevant.push(candidate);
    }

    for (const [wStart, wEnd] of windows) {
      let free = true;
      for (const act of relevant) {
        const aStart = parseTime(act.startTime);
        const aEnd = aStart + parseInt(act.duration) * 60;
        if (aStart < wEnd && aEnd > wStart) {
          free = false;
          break;
        }
      }
      if (free) return true;
    }
    return false;
  };

  // Returns the total number of THEORY teaching hours a staff member has on a
  // given day, including an optional candidate activity. Used to enforce the
  // "no 8 hours of theory per staff per day" constraint.
  const getTheoryHoursForTeacher = (teacherName: string, day: string, candidate: any, activityList: ActivityItem[]) => {
    const relevant = activityList.filter(a =>
      a.day === day && a.startTime !== 'No time' && a.teachers.includes(teacherName)
    );
    if (candidate && candidate.day === day && candidate.startTime !== 'No time' && candidate.teachers.includes(teacherName)) {
      relevant.push(candidate);
    }
    let hours = 0;
    for (const act of relevant) {
      const mod = modules.find(m => m.id === act.moduleId);
      if (mod?.type === 'Theory') {
        hours += parseInt(act.duration);
      }
    }
    return hours;
  };

  // Checks that a student class's lessons are back-to-back with no breaks,
  // except for a single 1-hour lunch break within the 11:00 AM - 2:00 PM window.
  // This prevents 2-hour or 3-hour gaps between lessons for the class.
  const hasNoExcessGapsForClass = (className: string, day: string, candidate: any, activityList: ActivityItem[]) => {
    const relevant = activityList.filter(a =>
      a.day === day && a.startTime !== 'No time' && a.studentClasses.includes(className)
    );
    if (candidate && candidate.day === day && candidate.startTime !== 'No time' && candidate.studentClasses.includes(className)) {
      relevant.push(candidate);
    }
    if (relevant.length <= 1) return true;

    const sorted = relevant
      .map(a => ({ start: parseTime(a.startTime), end: parseTime(a.startTime) + parseInt(a.duration) * 60 }))
      .sort((x, y) => x.start - y.start);

    const lunchStart = parseTime('11:00 AM');
    const lunchEnd = parseTime('2:00 PM');
    let gapCount = 0;

    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].start - sorted[i].end;
      if (gap <= 0) continue; // back-to-back or overlapping, no break
      const gapStart = sorted[i].end;
      const gapEnd = sorted[i + 1].start;
      const isLunchGap = gap === 60 && gapStart >= lunchStart && gapEnd <= lunchEnd;
      if (!isLunchGap) return false;
      gapCount++;
      if (gapCount > 1) return false;
    }
    return true;
  };

  const handleModuleSelect = (moduleId: string) => {
    setNewActivityModule(moduleId);
    const mod = modules.find(m => m.id === moduleId);
    if (mod) {
      setNewActivityTeachers(mod.teachers);
    } else {
      setNewActivityTeachers([]);
    }
  };

  const toggleActivityTeacher = (teacher: string) => {
    setNewActivityTeachers(prev => 
      prev.includes(teacher) ? prev.filter(t => t !== teacher) : [...prev, teacher]
    );
  };

  const checkClash = (activity: Partial<ActivityItem>, ignoreId?: string) => {
    if (!activity.day || activity.day === 'No day' || !activity.startTime || activity.startTime === 'No time') return null;

    const start = parseTime(activity.startTime);
    const durationHours = parseInt(activity.duration || '1');
    const end = start + durationHours * 60;
    const day = activity.day;

    // 1. Working Hours
    if (end > parseTime('5:00 PM')) {
      return `Time Error: Activity would end at ${calculateEndTime(activity.startTime, activity.duration!)}, which is past 5:00 PM.`;
    }

    // 2. Friday Noon (1-2pm on Fridays)
    if (day === 'Friday') {
      const friNoonStart = parseTime('1:00 PM');
      const friNoonEnd = parseTime('2:00 PM');
      if (start < friNoonEnd && end > friNoonStart) {
        return "Time Error: Friday noon (1:00 PM - 2:00 PM) must be kept free.";
      }
    }

    // 3. HBL Restrictions
    const mod = modules.find(m => m.id === activity.moduleId);
    const isPractical = mod?.type === 'Practical';
    if (hblDays.includes(day) && isPractical) {
      return `HBL Error: Practical lessons cannot be scheduled on HBL days (${day}).`;
    }

    // 4. Location Availability
    const loc = locations.find(l => l.name === activity.locationName);
    if (loc && locationAvailability[loc.id]?.[day] === 'Restricted') {
      return `Location Error: ${activity.locationName} is restricted on ${day}.`;
    }

    // 5. Lecturer Shifts
    if (activity.teachers) {
      for (const tName of activity.teachers) {
        const tId = staff.find(s => s.name === tName)?.id;
        if (tId) {
          // Per-staff HBL: staff on HBL that day cannot teach
          if ((staffHbl[tId] || []).includes(day)) {
            return `HBL Error: ${tName} is on Home-Based Learning on ${day}.`;
          }
          const shift = schedule[tId]?.[day] || 'None';
          if (shift === 'Off') return `Shift Error: ${tName} is Off on ${day}.`;
          if (shift === 'Morning' && end > parseTime('1:00 PM')) return `Shift Error: ${tName} only available for Morning shift (ends 1:00 PM).`;
          if (shift === 'Afternoon' && start < parseTime('1:00 PM')) return `Shift Error: ${tName} only available for Afternoon shift (starts 1:00 PM).`;
        }
      }
    }

    // 6. Lunch Break (each staff needs at least 1hr free in 11am-2pm window)
    if (activity.teachers) {
      for (const tName of activity.teachers) {
        if (!hasLunchBreak(tName, day, activity, activities)) {
          return `Lunch Error: ${tName} needs at least 1 hour free between 11:00 AM and 2:00 PM for lunch.`;
        }
      }
    }

    // 6.5 Max theory hours per staff per day (no 8 hours of theory)
    if (activity.teachers) {
      for (const tName of activity.teachers) {
        const theoryHours = getTheoryHoursForTeacher(tName, day, activity, activities);
        if (theoryHours >= 8) {
          return `Theory Hours Error: ${tName} would have ${theoryHours} hours of theory on ${day} (max 7 allowed).`;
        }
      }
    }

    // 7. No long breaks between lessons for students (only the 1hr lunch break allowed)
    if (activity.studentClasses) {
      for (const cName of activity.studentClasses) {
        if (!hasNoExcessGapsForClass(cName, day, activity, activities)) {
          return `Gap Error: Class ${cName} would have a break between lessons (only the 1hr lunch break is allowed).`;
        }
      }
    }

    // 8. Activity Clashes
    for (const a of activities) {
      if (a.id === ignoreId) continue;
      if (a.day !== day || a.startTime === 'No time') continue;

      const aStart = parseTime(a.startTime);
      const aEnd = aStart + parseInt(a.duration) * 60;

      const overlap = (start < aEnd && end > aStart);
      if (overlap) {
        const teacherMatch = a.teachers.find(t => activity.teachers?.includes(t));
        const classMatch = a.studentClasses.find(c => activity.studentClasses?.includes(c));
        const locationMatch = a.locationName === activity.locationName;

        if (teacherMatch) return `Teacher Clash: ${teacherMatch} is busy on ${a.day} at ${a.startTime}.`;
        if (classMatch) return `Class Clash: Class ${classMatch} already has a session on ${a.day} at ${a.startTime}.`;
        if (locationMatch) return `Location Clash: Room ${a.locationName} is already booked on ${a.day} at ${a.startTime}.`;
      }
    }
    return null;
  };

  const addActivity = () => {
    if (newActivityModule && newActivityLocation) {
      const selectedModule = modules.find(m => m.id === newActivityModule);
      const selectedLoc = locations.find(l => l.id === newActivityLocation);
      
      if (selectedModule && selectedLoc) {
        const newActivities: ActivityItem[] = [];
        for (let i = 0; i < newActivityCount; i++) {
          newActivities.push({
            id: Math.random().toString(36).substr(2, 9),
            moduleId: newActivityModule,
            moduleCode: selectedModule.code,
            moduleName: selectedModule.name,
            day: 'No day', // Force start as unscheduled
            startTime: 'No time', // Force start as unscheduled
            duration: newActivityDuration,
            studentClasses: selectedModule.studentClasses,
            teachers: newActivityTeachers,
            locationName: selectedLoc.name,
          });
        }
        setActivities([...activities, ...newActivities]);
        resetActivityForm();
        alert(`${newActivityCount} activities created and parked in Unscheduled section of Timetable tab.`);
      }
    }
  };

  const resetActivityForm = () => {
    setNewActivityModule('');
    setNewActivityTeachers([]);
    setNewActivityDay(null);
    setNewActivityTime(null);
    setNewActivityDuration('1 hr');
    setNewActivityCount(1);
    setNewActivityLocation('');
    setEditingActivityId(null);
  };

  const startEditActivity = (activity: ActivityItem) => {
    setEditingActivityId(activity.id);
    setNewActivityModule(activity.moduleId);
    setNewActivityTeachers(activity.teachers);
    setNewActivityDay(activity.day === 'No day' ? null : activity.day);
    setNewActivityTime(activity.startTime === 'No time' ? null : activity.startTime);
    setNewActivityDuration(activity.duration);
    setNewActivityLocation(locations.find(l => l.name === activity.locationName)?.id || '');
    
    // Switch to activities tab if not already there
    setActiveTab('activities');
    
    // Optional: Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateActivity = () => {
    if (editingActivityId && newActivityModule && newActivityLocation) {
      const selectedModule = modules.find(m => m.id === newActivityModule);
      const selectedLoc = locations.find(l => l.id === newActivityLocation);
      
      if (selectedModule && selectedLoc) {
        // Check for clashes only when manually editing to a specific slot
        const clashError = checkClash({
          day: newActivityDay || 'No day',
          startTime: newActivityTime || 'No time',
          duration: newActivityDuration,
          teachers: newActivityTeachers,
          studentClasses: selectedModule.studentClasses,
          locationName: selectedLoc.name
        }, editingActivityId);

        if (clashError) {
          alert(clashError);
          return;
        }

        setActivities(prev => prev.map(a => 
          a.id === editingActivityId ? {
            ...a,
            moduleId: newActivityModule,
            moduleCode: selectedModule.code,
            moduleName: selectedModule.name,
            day: newActivityDay || 'No day',
            startTime: newActivityTime || 'No time',
            duration: newActivityDuration,
            studentClasses: selectedModule.studentClasses,
            teachers: newActivityTeachers,
            locationName: selectedLoc.name,
          } : a
        ));
        resetActivityForm();
      }
    }
  };

  const removeModule = (id: string) => {
    setModules(modules.filter(m => m.id !== id));
  };

  // Delete the module currently selected in the New Activity form, along with
  // any activities that were created from it, then reset the module selection.
  const deleteModuleFromActivityForm = () => {
    if (!newActivityModule) return;
    const mod = modules.find(m => m.id === newActivityModule);
    if (!mod) return;
    if (confirm(`Delete module ${mod.code} - ${mod.name}?`)) {
      setModules(modules.filter(m => m.id !== newActivityModule));
      setActivities(prev => prev.filter(a => a.moduleId !== newActivityModule));
      setNewActivityModule('');
      setNewActivityTeachers([]);
    }
  };

  const updateShift = (staffId: string, day: string, shift: ShiftType) => {
    setSchedule(prev => ({
      ...prev,
      [staffId]: {
        ...(prev[staffId] || {}),
        [day]: shift,
      },
    }));
  };

  const clearStaffShifts = (staffId: string) => {
    setSchedule(prev => {
      const newSchedule = { ...prev };
      delete newSchedule[staffId];
      return newSchedule;
    });
  };

  const getShiftClass = (shift: ShiftType) => {
    switch (shift) {
      case 'Morning': return 'shift-morning';
      case 'Afternoon': return 'shift-afternoon';
      case 'Night': return 'shift-night';
      case 'Off': return 'shift-off';
      default: return 'shift-none';
    }
  };

  const rebuildTimetable = (showAlert: boolean = true) => {
    const errors: string[] = [];
    setActivities(prevActivities => {
      const updatedActivities = [...prevActivities];
      
      for (let i = 0; i < updatedActivities.length; i++) {
        const a = updatedActivities[i];
        if (a.day !== 'No day' && a.startTime !== 'No time') continue;
        
        const selectedModule = modules.find(m => m.id === a.moduleId);
        const isPractical = selectedModule?.type === 'Practical';
        const duration = parseInt(a.duration);
        let found = false;
        let failureReasons = new Set<string>();

        for (const day of DAYS.slice(0, 5)) {
          // New HBL Rule: Theory allowed, Practical blocked
          if (hblDays.includes(day) && isPractical) {
            failureReasons.add('Practical not allowed on HBL day');
            continue;
          }

          // Check Location Availability
          const loc = locations.find(l => l.name === a.locationName);
          if (loc && locationAvailability[loc.id]?.[day] === 'Restricted') {
            failureReasons.add(`Location ${a.locationName} restricted on ${day}`);
            continue;
          }

          for (const slot of TIME_SLOTS) {
            // Friday Noon rule (typically 12pm-2pm)
            if (day === 'Friday' && slot === '1:00 PM') {
              failureReasons.add('Friday noon kept free');
              continue;
            }
            
            const slotTime = parseTime(slot);
            const endTime = slotTime + duration * 60;
            if (endTime > parseTime('5:00 PM')) {
              failureReasons.add('Past 5:00 PM');
              continue;
            }

            // Check Lecturer Availability (Shifts)
            const lecturerNames = a.teachers;
            let shiftProblem = false;
            for (const tName of lecturerNames) {
              const tId = staff.find(s => s.name === tName)?.id;
              if (!tId) continue;
              // Per-staff HBL: staff on HBL that day cannot teach
              if ((staffHbl[tId] || []).includes(day)) {
                failureReasons.add(`${tName} is on HBL on ${day}`);
                shiftProblem = true;
                break;
              }
              const shift = schedule[tId]?.[day] || 'None';
              if (shift === 'Off') {
                failureReasons.add(`${tName} is Off on ${day}`);
                shiftProblem = true;
                break;
              }
              if (shift === 'Morning' && endTime > parseTime('1:00 PM')) {
                failureReasons.add(`${tName} only available for Morning shift`);
                shiftProblem = true;
                break;
              }
              if (shift === 'Afternoon' && slotTime < parseTime('1:00 PM')) {
                failureReasons.add(`${tName} only available for Afternoon shift`);
                shiftProblem = true;
                break;
              }
            }
            if (shiftProblem) continue;

            // Check Lunch Break (each staff needs at least 1hr free in 11am-2pm window)
            const candidate = { ...a, day, startTime: slot };
            let lunchProblem = false;
            for (const tName of lecturerNames) {
              if (!hasLunchBreak(tName, day, candidate, updatedActivities)) {
                failureReasons.add(`${tName} needs 1hr lunch break (11am-2pm)`);
                lunchProblem = true;
                break;
              }
            }
            if (lunchProblem) continue;

            // Check max theory hours per staff per day (no 8 hours of theory)
            let theoryProblem = false;
            for (const tName of lecturerNames) {
              if (getTheoryHoursForTeacher(tName, day, candidate, updatedActivities) >= 8) {
                failureReasons.add(`${tName} would exceed 7 hrs of theory on ${day}`);
                theoryProblem = true;
                break;
              }
            }
            if (theoryProblem) continue;

            // Check no long breaks between lessons for students (only 1hr lunch break allowed)
            let gapProblem = false;
            for (const cName of a.studentClasses) {
              if (!hasNoExcessGapsForClass(cName, day, candidate, updatedActivities)) {
                failureReasons.add(`Class ${cName} would have a break between lessons`);
                gapProblem = true;
                break;
              }
            }
            if (gapProblem) continue;

            // Check clash with other activities
            let clash = false;
            for (const existing of updatedActivities) {
              if (existing.id === a.id || existing.day !== day || existing.startTime === 'No time') continue;
              
              const eStart = parseTime(existing.startTime);
              const eEnd = eStart + parseInt(existing.duration) * 60;
              
              const overlap = (slotTime < eEnd && endTime > eStart);
              if (!overlap) continue;

              const teacherMatch = existing.teachers.find(t => a.teachers.includes(t));
              const classMatch = existing.studentClasses.find(c => a.studentClasses.includes(c));
              const locationMatch = existing.locationName === a.locationName;
              
              if (teacherMatch) failureReasons.add(`Clash: ${teacherMatch} already booked`);
              if (classMatch) failureReasons.add(`Clash: Class ${classMatch} already booked`);
              if (locationMatch) failureReasons.add(`Clash: Location ${a.locationName} already booked`);
              
              if (teacherMatch || classMatch || locationMatch) {
                clash = true;
                break;
              }
            }
            if (clash) continue;

            if (!clash) {
              updatedActivities[i] = { ...a, day, startTime: slot };
              found = true;
              break;
            }
          }
          if (found) break;
        }

        if (!found) {
          errors.push(`Could not schedule ${a.moduleCode} (${a.studentClasses.join(', ')}): ${Array.from(failureReasons).slice(0, 2).join(', ')}...`);
        }
      }
      
      return updatedActivities;
    });
    
    setSchedulingErrors(errors);
    if (showAlert) {
      if (errors.length > 0) {
        // Pop up the actual constraint reasons so the user can adjust the timetable.
        const detail = errors.slice(0, 10).map((e, i) => `${i + 1}. ${e}`).join('\n');
        const more = errors.length > 10 ? `\n...and ${errors.length - 10} more (see the list below).` : '';
        alert(`Timetable built with ${errors.length} constraint issue(s). Adjust the timetable to resolve:\n\n${detail}${more}`);
      } else {
        alert('Timetable auto-built successfully! All activities placed.');
      }
    }
  };

  const takeDownAll = () => {
    if (confirm('Are you sure you want to take down all scheduled activities?')) {
      setActivities(prev => prev.map(a => ({ ...a, day: 'No day', startTime: 'No time' })));
      setSchedulingErrors([]);
    }
  };

  const handleDrop = (e: React.DragEvent, day: string, slot: string) => {
    e.preventDefault();
    const activityId = e.dataTransfer.getData('activityId');
    const activity = activities.find(a => a.id === activityId);
    
    if (activity) {
      const clashError = checkClash({
        ...activity,
        day,
        startTime: slot,
      }, activityId);

      if (clashError) {
        alert(clashError);
        return;
      }

      setActivities(prev => prev.map(a => 
        a.id === activityId ? { ...a, day, startTime: slot } : a
      ));
    }
  };

  const handleCellDoubleClick = (activity: any) => {
    if (!activity) return;
    const action = window.confirm(`Activity: ${activity.moduleName}\n\nOK to Edit parameters\nCancel to Take Down (Unschedule)`);
    if (action) {
      startEditActivity(activity);
    } else {
      setActivities(prev => prev.map(a => 
        a.id === activity.id ? { ...a, day: 'No day', startTime: 'No time' } : a
      ));
    }
  };

  // HBL days to highlight on the timetable grid. When viewing a specific staff
  // member, use that staff's own HBL days; otherwise use the global HBL days.
  const viewHblDays = viewType === 'Staff'
    ? (staffHbl[selectedEntityId] || [])
    : hblDays;

  // Print / PDF: build a clean, dedicated print table from the SAME data/state
  // currently on screen (via getSlotContent), so it always reflects the current
  // view type and selected staff/class/location. Uses 10 separate equal-width
  // hourly columns (8:00 AM - 5:00 PM) and A4 landscape layout.
  const handlePrint = () => {
    // Resolve the current view type label and selected entity name from state.
    const viewLabel = viewType === 'Student' ? 'Class' : viewType;
    let entityName = '';
    if (viewType === 'Student') {
      entityName = studentClasses.find(c => c.id === selectedEntityId)?.name || '';
    } else if (viewType === 'Staff') {
      entityName = staff.find(s => s.id === selectedEntityId)?.name || '';
    } else if (viewType === 'Location') {
      entityName = locations.find(l => l.id === selectedEntityId)?.name || '';
    }

    const title = 'Weekly Timetable';
    const headerLine = entityName ? `${viewLabel}: ${entityName}` : viewLabel;

    // Build the header row: DAY + 10 hourly columns.
    let headerCells = '<th class="day-column-header">DAY</th>';
    for (const slot of PRINT_TIME_SLOTS) {
      headerCells += `<th>${slot}</th>`;
    }

    // Build the body rows from the live data for the current selection.
    let bodyRows = '';
    for (const day of DAYS.slice(0, 5)) {
      const isHbl = viewHblDays.includes(day);
      bodyRows += `<tr class="${isHbl ? 'hbl-day-row' : ''}">`;
      bodyRows += `<td class="day-name-cell">${day}${isHbl ? '<div class="hbl-indicator">HBL</div>' : ''}</td>`;
      for (const slot of PRINT_TIME_SLOTS) {
        const content = getSlotContent(day, slot);
        if (content && content.type === 'activity') {
          bodyRows += `<td class="activity-slot"><span class="cell-label-text">${content.label}</span>${content.extra ? `<span class="cell-extra-text">${content.extra}</span>` : ''}</td>`;
        } else {
          bodyRows += '<td></td>';
        }
      }
      bodyRows += '</tr>';
    }

    // Column widths: DAY ~10%, each of the 10 time columns ~9%.
    let colgroup = '<colgroup><col style="width:10%">';
    for (let i = 0; i < PRINT_TIME_SLOTS.length; i++) colgroup += '<col style="width:9%">';
    colgroup += '</colgroup>';

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      // Popup blocked — fall back to printing the current page.
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${headerLine}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1a202c;
            }
            .print-header {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              border-bottom: 2px solid #1a202c;
              padding-bottom: 6px;
              margin-bottom: 10px;
            }
            .print-header h1 { margin: 0; font-size: 18px; }
            .print-header .print-sub { font-size: 13px; color: #4a5568; font-weight: 600; }
            table {
              border-collapse: collapse;
              width: 100%;
              table-layout: fixed;
            }
            th, td {
              border: 1px solid #cbd5e0;
              padding: 6px 3px;
              text-align: center;
              font-size: 10px;
              vertical-align: middle;
              word-wrap: break-word;
              overflow-wrap: break-word;
              white-space: normal;
            }
            th { background: #edf2f7; font-weight: 700; }
            .day-column-header, .day-name-cell { text-align: left; font-weight: 700; }
            .hbl-day-row { background: #fff5f5; }
            .hbl-indicator { color: #e53e3e; font-weight: 800; font-size: 8px; margin-top: 2px; }
            .activity-slot { background: #ebf8ff; }
            .cell-label-text { font-weight: 700; font-size: 9px; display: block; }
            .cell-extra-text { font-weight: 800; font-size: 8px; opacity: 0.6; display: block; }
            tr { break-inside: avoid; }
            @media print {
              body { padding: 0; }
              .print-header { margin-bottom: 8px; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>${title}</h1>
            <span class="print-sub">${headerLine}</span>
          </div>
          <table>
            ${colgroup}
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-top">
          <h1>Department <span>Timetable</span></h1>
          <nav className="tabs">
            <button 
              className={`tab-btn ${activeTab === 'timetables' ? 'active' : ''}`}
              onClick={() => setActiveTab('timetables')}
            >
              <span className="tab-icon">📅</span> Timetables
            </button>
            <button 
              className={`tab-btn ${activeTab === 'resources' ? 'active' : ''}`}
              onClick={() => setActiveTab('resources')}
            >
              <span className="tab-icon">👥</span> Resources
            </button>
            <button 
              className={`tab-btn ${activeTab === 'modules' ? 'active' : ''}`}
              onClick={() => setActiveTab('modules')}
            >
              <span className="tab-icon">📖</span> Modules
            </button>
            <button 
              className={`tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
              onClick={() => setActiveTab('activities')}
            >
              <span className="tab-icon">📋</span> Activities
            </button>
            <button 
              className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveTab('rules')}
            >
              <span className="tab-icon">⚙️</span> Rules
            </button>
          </nav>
        </div>

        {activeTab === 'timetables' && (
          <div className="timetables-page">
            <div className="timetables-header">
              <div className="timetables-title-group">
                <h2 className="page-title">Weekly timetables</h2>
                <p className="page-subtitle">
                  Days run down the side, 1-hour slots from 8:00 AM to 5:00 PM run across the top. Grids rebuild the moment data changes.
                </p>
              </div>
              <div className="timetables-actions">
                <button className="btn-outline-icon" onClick={() => rebuildTimetable(true)}>
                  <span className="icon">🔄</span> Rebuild timetable
                </button>
                <button className="btn-outline-icon" onClick={takeDownAll}>
                  <span className="icon">🧹</span> Take down all
                </button>
                <button className="btn-dark" onClick={() => setActiveTab('activities')}>
                  Reset / refill form
                </button>
              </div>
            </div>

            {schedulingErrors.length > 0 && (
              <div className="scheduling-errors-section">
                <div className="error-card">
                  <h4>⚠️ Scheduling Issues ({schedulingErrors.length})</h4>
                  <ul className="error-list">
                    {schedulingErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                  </ul>
                  <button className="clear-errors-btn" onClick={() => setSchedulingErrors([])}>Dismiss</button>
                </div>
              </div>
            )}

            <div className="unscheduled-section">
              <h3 className="unscheduled-title">UNSCHEDULED FOR THIS {viewType.toUpperCase()}</h3>
              <div className="unscheduled-cards-grid">
                {activities.filter(a => {
                  const isUnscheduled = a.day === 'No day' || a.startTime === 'No time';
                  if (!isUnscheduled) return false;
                  
                  const currentEntity = viewType === 'Student' 
                    ? studentClasses.find(c => c.id === selectedEntityId)?.name 
                    : viewType === 'Staff' 
                      ? staff.find(s => s.id === selectedEntityId)?.name 
                      : locations.find(l => l.id === selectedEntityId)?.name;
                  
                  if (!currentEntity) return false;
                  
                  return (viewType === 'Student' && a.studentClasses.includes(currentEntity)) ||
                         (viewType === 'Staff' && a.teachers.includes(currentEntity)) ||
                         (viewType === 'Location' && a.locationName === currentEntity);
                }).map(a => (
                  <div 
                    key={a.id} 
                    className="unscheduled-card"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('activityId', a.id)}
                  >
                    <div className="card-module">{a.moduleCode}</div>
                    <div className="card-class">{a.studentClasses.join(', ')}</div>
                    <div className="card-staff">{a.teachers.join(' · ')}</div>
                    <div className="card-location">{a.locationName}</div>
                  </div>
                ))}
              </div>
              {activities.filter(a => {
                const isUnscheduled = a.day === 'No day' || a.startTime === 'No time';
                if (!isUnscheduled) return false;
                const currentEntity = viewType === 'Student' 
                  ? studentClasses.find(c => c.id === selectedEntityId)?.name 
                  : viewType === 'Staff' 
                    ? staff.find(s => s.id === selectedEntityId)?.name 
                    : locations.find(l => l.id === selectedEntityId)?.name;
                if (!currentEntity) return false;
                return (viewType === 'Student' && a.studentClasses.includes(currentEntity)) ||
                       (viewType === 'Staff' && a.teachers.includes(currentEntity)) ||
                       (viewType === 'Location' && a.locationName === currentEntity);
              }).length === 0 && (
                <p className="no-unscheduled-msg">No unscheduled activities for this {viewType.toLowerCase()}.</p>
              )}
            </div>

            <div className="view-switcher-section">
              <div className="view-type-pills">
                <button 
                  className={`view-pill ${viewType === 'Student' ? 'active' : ''}`}
                  onClick={() => setViewType('Student')}
                >
                  Student
                </button>
                <button 
                  className={`view-pill ${viewType === 'Staff' ? 'active' : ''}`}
                  onClick={() => setViewType('Staff')}
                >
                  Staff
                </button>
                <button 
                  className={`view-pill ${viewType === 'Location' ? 'active' : ''}`}
                  onClick={() => setViewType('Location')}
                >
                  Location
                </button>
              </div>
            </div>

            <div className="entity-selection-row">
              <div className="entity-pills-scroll">
                {viewType === 'Student' && studentClasses.map(sc => (
                  <button 
                    key={sc.id} 
                    className={`entity-pill ${selectedEntityId === sc.id ? 'active' : ''}`}
                    onClick={() => setSelectedEntityId(sc.id)}
                  >
                    {sc.name}
                  </button>
                ))}
                {viewType === 'Staff' && staff.map(s => (
                  <button 
                    key={s.id} 
                    className={`entity-pill ${selectedEntityId === s.id ? 'active' : ''}`}
                    onClick={() => setSelectedEntityId(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
                {viewType === 'Location' && locations.map(l => (
                  <button 
                    key={l.id} 
                    className={`entity-pill ${selectedEntityId === l.id ? 'active' : ''}`}
                    onClick={() => setSelectedEntityId(l.id)}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
              <button className="btn-outline-icon print-btn" onClick={handlePrint}>
                <span className="icon">🖨️</span> Print / PDF
              </button>
            </div>

            <div className="timetable-grid-container">
              <table className="timetable-grid">
                <thead>
                  <tr>
                    <th className="day-column-header">DAY</th>
                    {TIME_SLOTS.map((slot, index) => (
                      <th key={slot}>
                        <span className="time-header-label">{slot}</span>
                        {index === TIME_SLOTS.length - 1 && (
                          <span className="time-header-label end-label">5:00 PM</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.slice(0, 5).map(day => (
                    <tr key={day} className={viewHblDays.includes(day) ? 'hbl-day-row' : ''}>
                      <td className="day-name-cell">
                        {day}
                        {viewHblDays.includes(day) && <div className="hbl-indicator">HBL</div>}
                      </td>
                      {TIME_SLOTS.map(slot => {
                        const content = getSlotContent(day, slot);
                        return (
                          <td 
                            key={slot} 
                            className={`timetable-slot-cell ${content?.type ? `${content.type}-slot` : ''}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, day, slot)}
                            onDoubleClick={() => content?.activity && handleCellDoubleClick(content.activity)}
                            draggable={!!content?.activity}
                            onDragStart={(e) => content?.activity && e.dataTransfer.setData('activityId', content.activity.id)}
                          >
                            {content && (
                              <div className={`${content.type}-cell-content`}>
                                <span className="cell-label-text">{content.label}</span>
                                {content.extra && <span className="cell-extra-text">{content.extra}</span>}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="header-controls">
            <p>Manage your rooms, classes and lecturers here.</p>
          </div>
        )}

        {activeTab === 'modules' && null}
      </header>

      <main className="content">
        {activeTab === 'timetables' && (
          <>
            <div className="filter-section">
              <input
                type="text"
                placeholder="Filter by lecturer..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="filter-input"
              />
            </div>

            <div className="table-wrapper">
              <table className="timetable">
                <thead>
                  <tr>
                    <th>Lecturer</th>
                    {DAYS.map(day => (
                      <th key={day}>{day}</th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map(member => (
                    <tr key={member.id}>
                      <td className="staff-name">{member.name}</td>
                      {DAYS.map(day => {
                        const currentShift = schedule[member.id]?.[day] || 'None';
                        return (
                          <td key={day} className="shift-cell">
                            <select
                              className={`shift-select ${getShiftClass(currentShift)}`}
                              value={currentShift}
                              onChange={(e) => updateShift(member.id, day, e.target.value as ShiftType)}
                            >
                              <option value="None">-</option>
                              {SHIFT_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                            <div className="cell-activities">
                              {activities
                                .filter(a => a.day === day && a.teachers.includes(member.name) && a.startTime !== 'No time')
                                .map(a => (
                                  <div key={a.id} className="mini-activity-tag" title={`${a.moduleCode} at ${a.startTime}`}>
                                    {a.moduleCode} ({a.startTime})
                                  </div>
                                ))}
                            </div>
                          </td>
                        );
                      })}
                      <td className="actions-cell">
                        <button 
                          className="btn-icon" 
                          onClick={() => clearStaffShifts(member.id)}
                          title="Clear Shifts"
                        >
                          🧹
                        </button>
                        <button 
                          className="btn-icon-danger" 
                          onClick={() => removeStaff(member.id)}
                          title="Remove Lecturer"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'resources' && (
          <div className="resources-container">
            {/* Labs & Rooms */}
            <div className="resource-card">
              <h3 className="resource-title">LABS & ROOMS</h3>
              <div className="resource-input-group">
                <input
                  type="text"
                  placeholder="Add labs & rooms"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addLocation()}
                />
                <button className="add-resource-btn" onClick={addLocation}>+</button>
              </div>
              <div className="resource-tags">
                {locations.map(loc => (
                  <div key={loc.id} className="resource-tag">
                    <span>{loc.name}</span>
                    <button onClick={() => removeLocation(loc.id)}>&times;</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Student Classes */}
            <div className="resource-card">
              <h3 className="resource-title">STUDENT CLASSES</h3>
              <div className="resource-input-group">
                <input
                  type="text"
                  placeholder="Add student classes"
                  value={newStudentClassName}
                  onChange={(e) => setNewStudentClassName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addStudentClass()}
                />
                <button className="add-resource-btn" onClick={addStudentClass}>+</button>
              </div>
              <div className="resource-tags">
                {studentClasses.map(sc => (
                  <div key={sc.id} className="resource-tag">
                    <span>{sc.name}</span>
                    <button onClick={() => removeStudentClass(sc.id)}>&times;</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Lecturers */}
            <div className="resource-card">
              <h3 className="resource-title">LECTURERS</h3>
              <div className="resource-input-group">
                <input
                  type="text"
                  placeholder="Add lecturers"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addStaff()}
                />
                <button className="add-resource-btn" onClick={addStaff}>+</button>
              </div>
              <div className="resource-tags">
                {staff.map(member => (
                  <div key={member.id} className="resource-tag">
                    <span>{member.name}</span>
                    <button onClick={() => removeStaff(member.id)}>&times;</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'modules' && (
          <div className="modules-page">
            <div className="module-form-card">
              <h3 className="form-section-title">NEW MODULE</h3>
              
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Module code"
                  value={newModuleCode}
                  onChange={(e) => setNewModuleCode(e.target.value)}
                  className="module-input"
                />
                <input
                  type="text"
                  placeholder="Module title"
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  className="module-input"
                />
              </div>

              <div className="form-section">
                <h4 className="field-label">STUDENT CLASSES (SELECT ONE OR MORE)</h4>
                <div className="pill-group">
                  {studentClasses.map(sc => (
                    <button
                      key={sc.id}
                      className={`pill-btn ${selectedClasses.includes(sc.name) ? 'selected' : ''}`}
                      onClick={() => toggleStudentClass(sc.name)}
                    >
                      {sc.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-column">
                  <h4 className="field-label">TYPE</h4>
                  <div className="pill-group">
                    <button
                      className={`pill-btn ${selectedType === 'Theory' ? 'selected' : ''}`}
                      onClick={() => setSelectedType('Theory')}
                    >
                      Theory
                    </button>
                    <button
                      className={`pill-btn ${selectedType === 'Practical' ? 'selected' : ''}`}
                      onClick={() => setSelectedType('Practical')}
                    >
                      Practical
                    </button>
                  </div>
                </div>
                <div className="form-column">
                  <h4 className="field-label">HOURS</h4>
                  <input
                    type="number"
                    value={newModuleHours}
                    onChange={(e) => setNewModuleHours(e.target.value)}
                    className="module-input hours-input"
                  />
                </div>
              </div>

              <div className="form-section">
                <h4 className="field-label">TEACHERS (UP TO 4)</h4>
                <div className="pill-group">
                  {staff.map(member => (
                    <button
                      key={member.id}
                      className={`pill-btn ${selectedTeachers.includes(member.name) ? 'selected' : ''}`}
                      onClick={() => toggleTeacher(member.name)}
                    >
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>

              <button className="add-module-submit-btn" onClick={addModule}>
                Add module
              </button>
            </div>

            {modules.length > 0 && (
              <div className="modules-list-section">
                <h3 className="form-section-title">ADDED MODULES</h3>
                <div className="modules-grid">
                  {modules.map(mod => (
                    <div key={mod.id} className="module-item-card">
                      <div className="module-item-header">
                        <span className="module-item-code">{mod.code}</span>
                        <button className="remove-btn" onClick={() => removeModule(mod.id)}>&times;</button>
                      </div>
                      <div className="module-item-title">{mod.name}</div>
                      <div className="module-item-details">
                        <span>{mod.type} • {mod.hours}h</span>
                        <div className="module-item-tags">
                          {mod.studentClasses.map(c => <span key={c} className="mini-tag">{c}</span>)}
                        </div>
                        <div className="module-item-teachers mt-2">
                          {mod.teachers.map(t => (
                            <button 
                              key={t} 
                              className="mini-teacher-tag"
                              onClick={() => {
                                setNewActivityModule(mod.id);
                                setActiveTab('activities');
                              }}
                              title="Click to schedule activity for this teacher"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button 
                        className="btn-create-activity mt-4"
                        onClick={() => {
                          setNewActivityModule(mod.id);
                          setActiveTab('activities');
                        }}
                      >
                        Schedule Activity
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="activities-page">
            <div className="activities-header">
              <div className="activities-title-group">
                <h2 className="page-title">Activities</h2>
                <p className="page-subtitle">
                  Every entry lands on the timetables instantly. Clashes for teachers, classes and rooms are blocked automatically.
                </p>
              </div>
              <button className="btn-outline" onClick={clearActivities}>
                Clear all activities
              </button>
            </div>

            <div className="activity-form-card">
              <h3 className="form-section-title">{editingActivityId ? 'EDIT ACTIVITY' : 'NEW ACTIVITY'}</h3>
              
              <div className="form-grid">
                <div className="form-field">
                  <label className="field-label">MODULE</label>
                  <div className="module-select-row">
                    <select
                      value={newActivityModule}
                      onChange={(e) => handleModuleSelect(e.target.value)}
                      className="module-select"
                    >
                      <option value="">Select module</option>
                      {modules.filter(mod => {
                        // Show if it doesn't have an activity OR if we are currently editing its activity
                        const hasActivity = activities.some(a => a.moduleId === mod.id);
                        const isEditingThisMod = editingActivityId && activities.find(a => a.id === editingActivityId)?.moduleId === mod.id;
                        return !hasActivity || isEditingThisMod;
                      }).map(mod => (
                        <option key={mod.id} value={mod.id}>
                          {mod.code} - {mod.name} ({mod.type} • {mod.studentClasses.join(', ')})
                        </option>
                      ))}
                    </select>
                    {newActivityModule && (
                      <button
                        className="module-delete-btn"
                        onClick={deleteModuleFromActivityForm}
                        title="Delete this module"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  <p className="field-hint">Modules already scheduled are hidden.</p>
                </div>

                <div className="form-field">
                  <label className="field-label">DAY</label>
                  <select 
                    value={newActivityDay || ''} 
                    onChange={(e) => setNewActivityDay(e.target.value || null)}
                    className="module-select"
                  >
                    <option value="">No day (nil)</option>
                    {DAYS.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="field-label">START TIME</label>
                  <select 
                    value={newActivityTime || ''} 
                    onChange={(e) => setNewActivityTime(e.target.value || null)}
                    className="module-select"
                  >
                    <option value="">No time (nil)</option>
                    {TIME_SLOTS.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="field-label">DURATION</label>
                  <select 
                    value={newActivityDuration} 
                    onChange={(e) => setNewActivityDuration(e.target.value)}
                    className="module-select"
                  >
                    <option value="1 hr">1 hr</option>
                    <option value="2 hrs">2 hrs</option>
                    <option value="3 hrs">3 hrs</option>
                    <option value="4 hrs">4 hrs</option>
                  </select>
                </div>

                {!editingActivityId && (
                  <div className="form-field">
                    <label className="field-label">NUMBER OF ACTIVITIES</label>
                    <select 
                      value={newActivityCount} 
                      onChange={(e) => setNewActivityCount(Number(e.target.value))}
                      className="module-select"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </div>
                )}

                <div className="form-field">
                  <label className="field-label">LOCATION</label>
                  <select 
                    value={newActivityLocation} 
                    onChange={(e) => setNewActivityLocation(e.target.value)}
                    className="module-select"
                  >
                    <option value="">Select location</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-section">
                <h4 className="field-label">TEACHERS (SELECT FOR ACTIVITY - UP TO 4)</h4>
                {newActivityModule ? (
                  <div className="pill-group mb-4">
                    {modules.find(m => m.id === newActivityModule)?.teachers.map(teacher => (
                      <button 
                        key={teacher} 
                        className={`pill-btn ${newActivityTeachers.includes(teacher) ? 'selected' : ''}`}
                        onClick={() => toggleActivityTeacher(teacher)}
                      >
                        {teacher}
                      </button>
                    ))}
                    {modules.find(m => m.id === newActivityModule)?.teachers.length === 0 && (
                      <p className="field-hint">No teachers assigned to this module. Go to Modules tab to assign.</p>
                    )}
                  </div>
                ) : (
                  <p className="field-hint mb-4">Select a module to see available teachers.</p>
                )}
              </div>

              <div className="form-footer-note">
                Pick a day and time to schedule directly, or leave them as "No day/time" to save unscheduled — then use <strong>Rebuild</strong> on the Timetables page to auto-place any unscheduled ones.
              </div>

              <div className="form-actions">
                {editingActivityId ? (
                  <>
                    <button className="add-activity-btn" onClick={updateActivity}>
                      Update activity
                    </button>
                    <button className="reset-link" onClick={resetActivityForm}>
                      Cancel edit
                    </button>
                  </>
                ) : (
                  <>
                    <button className="add-activity-btn" onClick={addActivity}>
                      Add activity
                    </button>
                    <button className="reset-link" onClick={resetActivityForm}>
                      Reset form
                    </button>
                  </>
                )}
              </div>
            </div>

            {activities.length === 0 && (
              <div className="empty-activities-placeholder">
                <div className="placeholder-card">
                  <h4>All activities taken down</h4>
                  <p>Everything is unscheduled now — hit Rebuild to regenerate.</p>
                </div>
                <div className="placeholder-card">
                  <h4>All activities taken down</h4>
                  <p>Everything is unscheduled now — hit Rebuild to regenerate.</p>
                </div>
              </div>
            )}

            <div className="activity-list-section">
              {activities.map(activity => {
                const endTime = calculateEndTime(activity.startTime, activity.duration);
                const isScheduled = activity.day !== 'No day' && activity.startTime !== 'No time';
                
                return (
                  <div key={activity.id} className="activity-item-row">
                    <div className="activity-main-info">
                      <span className="activity-code">{activity.moduleCode}</span>
                      <span className="activity-details">
                        • {activity.day} {isScheduled ? `${activity.startTime}–${endTime}` : <span className="unscheduled-label">Unscheduled</span>} 
                        • {activity.duration} 
                        • {activity.studentClasses.join(', ')} 
                        • {activity.teachers.join(', ')} 
                        • {activity.locationName}
                      </span>
                    </div>
                    <div className="activity-actions">
                      <button className="icon-btn-gray" onClick={() => startEditActivity(activity)}>✏️</button>
                      <button className="icon-btn-gray" onClick={() => setActivities(activities.filter(a => a.id !== activity.id))}>🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="rules-page">
            <div className="rules-header">
              <div className="rules-title-group">
                <h2 className="page-title">Rules</h2>
                <p className="page-subtitle">
                  Block Home-Based Learning days and mark which rooms are free or restricted on each day.
                </p>
              </div>
              <button className="save-rules-btn" onClick={saveRules}>
                Save rules
              </button>
            </div>

            <div className="rules-card">
              <h3 className="form-section-title">HOME-BASED LEARNING DAYS</h3>
              <div className="pill-group mt-6">
                {DAYS.slice(0, 5).map(day => (
                  <button
                    key={day}
                    className={`pill-btn ${hblDays.includes(day) ? 'selected' : ''}`}
                    onClick={() => toggleHblDay(day)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="rules-card mt-8">
              <h3 className="form-section-title">STAFF HOME-BASED LEARNING DAYS</h3>
              <p className="field-hint mb-6">
                Assign HBL per staff member. Use <strong>All</strong> on a day column to select every staff, or toggle individual staff. Staff on HBL that day will not be scheduled to teach.
              </p>

              <div className="availability-grid-wrapper">
                <table className="availability-table staff-hbl-table">
                  <thead>
                    <tr>
                      <th>STAFF</th>
                      {DAYS.slice(0, 5).map(day => {
                        const allSelected = staff.length > 0 && staff.every(s => (staffHbl[s.id] || []).includes(day));
                        return (
                          <th key={day}>
                            <div className="staff-hbl-day-head">
                              <span>{day.slice(0, 3).toUpperCase()}</span>
                              <button
                                className={`staff-hbl-all-btn ${allSelected ? 'selected' : ''}`}
                                onClick={() => setAllStaffHbl(day, !allSelected)}
                                title={allSelected ? `Remove all staff from ${day} HBL` : `Select all staff for ${day} HBL`}
                              >
                                All
                              </button>
                            </div>
                          </th>
                        );
                      })}
                      <th>
                        <span className="staff-hbl-all-label">ALL DAYS</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(member => {
                      const allDays = (staffHbl[member.id] || []).length === DAYS.slice(0, 5).length;
                      return (
                        <tr key={member.id}>
                          <td className="location-name">{member.name}</td>
                          {DAYS.slice(0, 5).map(day => {
                            const isHbl = (staffHbl[member.id] || []).includes(day);
                            return (
                              <td key={day}>
                                <button
                                  className={`availability-cell ${isHbl ? 'restricted' : 'free'}`}
                                  onClick={() => toggleStaffHbl(member.id, day)}
                                  title={isHbl ? `${member.name} on HBL ${day}` : `${member.name} not on HBL ${day}`}
                                >
                                  {isHbl ? 'HBL' : '—'}
                                </button>
                              </td>
                            );
                          })}
                          <td>
                            <button
                              className={`staff-hbl-all-btn ${allDays ? 'selected' : ''}`}
                              onClick={() => setAllDaysForStaff(member.id, !allDays)}
                              title={allDays ? `Clear all HBL days for ${member.name}` : `Set all HBL days for ${member.name}`}
                            >
                              {allDays ? 'Clear' : 'All'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rules-card mt-8">
              <h3 className="form-section-title">LOCATION AVAILABILITY</h3>
              <p className="field-hint mb-6">Tap a cell to switch between free and restricted.</p>
              
              <div className="availability-grid-wrapper">
                <table className="availability-table">
                  <thead>
                    <tr>
                      <th>LOCATION</th>
                      {DAYS.slice(0, 5).map(day => (
                        <th key={day}>{day.slice(0, 3).toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map(loc => (
                      <tr key={loc.id}>
                        <td className="location-name">{loc.name}</td>
                        {DAYS.slice(0, 5).map(day => {
                          const status = locationAvailability[loc.id]?.[day] || 'Free';
                          return (
                            <td key={day}>
                              <button
                                className={`availability-cell ${status.toLowerCase()}`}
                                onClick={() => toggleLocationAvailability(loc.id, day)}
                              >
                                {status}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        {activeTab === 'timetables' && (
          <div className="legend">
            <span className="legend-item"><span className="dot shift-morning"></span> Morning</span>
            <span className="legend-item"><span className="dot shift-afternoon"></span> Afternoon</span>
            <span className="legend-item"><span className="dot shift-night"></span> Night</span>
            <span className="legend-item"><span className="dot shift-off"></span> Off</span>
          </div>
        )}
      </footer>
    </div>
  );
}

export default App;
