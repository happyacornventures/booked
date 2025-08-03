import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const getCalendarPermissions = async () => (await Calendar.requestCalendarPermissionsAsync()).status === 'granted';
const getCalendars = async () => await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

const createCalendar = async (cal: Partial<Calendar.Calendar>) => {
  const defaultCalendarSource = Platform.OS === 'ios'
    ? (await Calendar.getDefaultCalendarAsync()).source
    : { isLocalAccount: true, name: 'Booked', type: 'local' };

  return await Calendar.createCalendarAsync({
    entityType: Calendar.EntityTypes.EVENT,
    source: defaultCalendarSource,
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
    ...cal
  });
};

const fetchEvents = async (calendars: string[], days: number = 14) => {
  if (calendars.length === 0) return [];

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  let allEvents: Calendar.Event[] = [];

    try {
      allEvents = await Calendar.getEventsAsync(calendars, startDate, endDate);
    } catch (error) {
      console.log(`Error fetching events for calendars:`, error);
    }

  console.log(`${allEvents.length} events fetched for the next ${days} days.`);
  return allEvents;
};

const clearEvents = async (events: Calendar.Event[]) => {
  if (events.length === 0) return;

  try {
    for (const event of events) {
      await Calendar.deleteEventAsync(event.id, { futureEvents: true, instanceStartDate: event.startDate });
      console.log('deleted event:', event.startDate, event.id);
    }
    console.log('cleared events:', events.length);
  } catch (error) {
    console.log('Error clearing events:', error);
  }
};

const createEventOnCalendar = async (targetCalendarId: string, events: Partial<Calendar.Event>[]) => {
  if (events.length === 0 || !targetCalendarId) return;

  try {
    for (const event of events) {
      await Calendar.createEventAsync(targetCalendarId, event);
      console.log('added event:', event.startDate);
    }
    console.log('added events:', events.length);
  } catch (error) {
    console.log('Error adding events:', error);
  }
};

const getPlannedDayCount = (): number => {
  // get days to end of month
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  let daysToEndOfMonth = Math.ceil((endOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // if days to end of month is < 21, get days of next month
  if (daysToEndOfMonth < 21) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const endOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
    // console.error("returning days to end of next month:", daysToEndOfMonth);
    daysToEndOfMonth = Math.ceil((endOfNextMonth.getTime() - nextMonth.getTime()) / (1000 * 60 * 60 * 24) + daysToEndOfMonth);
  }
  // console.error("returning days to end of month:", daysToEndOfMonth);
  return daysToEndOfMonth;
  // return 90;
}

const createBookedEvent = ({id, startDate, endDate, status, allDay, availability, ...evt}: Calendar.Event) => ({startDate, endDate, allDay, availability, status, title: "Booked" });

const groupCalendarsBySource = (calendars: Calendar.Calendar[]) => {
  return calendars.reduce((groups, calendar) => {
    const sourceName = calendar.source.name;
    if (!groups[sourceName]) {
      groups[sourceName] = [];
    }
    groups[sourceName].push(calendar);
    return groups;
  }, {} as Record<string, Calendar.Calendar[]>);
};

let timeoutId: number | null = null;
const debounceDelay = 3000;

const debouncedSyncCalendarEvents = (calendarId: string, events: Calendar.Event[], signalSyncRunning: (value: React.SetStateAction<boolean>) => void) => {
  // debounce syncing to prevent rapid calls
  signalSyncRunning(true);
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    fetchEvents(calendarId ? [calendarId] : [], getPlannedDayCount())
      .then(clearEvents)
      .then(() => createEventOnCalendar(calendarId, events.map(createBookedEvent)))
      .then(() => signalSyncRunning(false)).then(() => timeoutId = null);
  }, debounceDelay);
};

export default function Index() {
  const [calendarPermissions, setCalendarPermissions] = useState(false);
  const [calendars, setCalendars] = useState<Calendar.Calendar[]>([]);
  const [booked, setBooked] = useState<Calendar.Calendar | null>(null);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [events, setEvents] = useState<Calendar.Event[]>([]);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [clearingBookedEvents, setClearingBookedEvents] = useState(false);

  const groupedCalendars = groupCalendarsBySource(calendars.filter(c => c.id !== booked?.id));

  const toggleCalendarSelection = (calendarId: string) => {
    setSelectedCalendars(prevSelected =>
      prevSelected.includes(calendarId)
        ? prevSelected.filter(id => id !== calendarId)
        : [...prevSelected, calendarId]
    );
  };

  const toggleSourceExpansion = (sourceName: string) => {
    setExpandedSources(prevExpanded => ({
      ...prevExpanded,
      [sourceName]: !prevExpanded[sourceName],
    }));
  };

  // load selected calendars from AsyncStorage when component mounts
  useEffect(() => {
    // Load selected calendars from AsyncStorage when component mounts
    const loadSelectedCalendars = async () => {
      try {
        const savedCalendars = await AsyncStorage.getItem('calendars');
        if (savedCalendars !== null) {
          setSelectedCalendars(JSON.parse(savedCalendars));
        }
      } catch (error) {
        console.error('Error loading selected calendars:', error);
      }
    };

    loadSelectedCalendars();
  }, []);

  // get permission to read calendars
  useEffect(() => {
    getCalendarPermissions().then(setCalendarPermissions);
  }, []);

  // get all calendars when permissions are granted
  useEffect(() => {
    if (!calendarPermissions) return;
    getCalendars().then(setCalendars);
  }, [calendarPermissions]);

  // create default calendar if it doesn't exist
  useEffect(() => {
    if (!calendars.length) return;
    let booked = calendars.find(cal => cal.title === 'Booked');
    if (booked) setBooked(booked);
    else createCalendar({title: 'Booked', name: 'Booked', color: '#FF5733'}).then(getCalendars).then(setCalendars);
    // calendars will be set, retriggering this effect
  }, [calendars]);

  // // Save selected calendars to AsyncStorage whenever they change
  useEffect(() => {
    const saveSelectedCalendars = async () => {
      try {
        await AsyncStorage.setItem('calendars', JSON.stringify(selectedCalendars));
      } catch (error) {
        console.error('Error saving selected calendars:', error);
      }
    };

    saveSelectedCalendars();
  }, [selectedCalendars]);

  // update fetched events when calendar selection changes
  useEffect(() => {
    fetchEvents(selectedCalendars, getPlannedDayCount()).then(setEvents);
  }, [selectedCalendars]);

  if (!calendarPermissions) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Booked needs access to your calendar to work.</Text>
      </View>
    );
  }

  return (
    <ScrollView>
      <Text style={{ fontSize: 24, margin: 10, marginTop: 70 }}>Available Calendars:</Text>
      {Object.entries(groupedCalendars).map(([sourceName, cals]) => (
        <View key={sourceName}>
          <TouchableOpacity
            onPress={() => toggleSourceExpansion(sourceName)}
            style={{ flexDirection: 'row', alignItems: 'center', margin: 10 }}
          >
            <Ionicons
              name={expandedSources[sourceName] ? "chevron-down" : "chevron-forward"}
              size={24}
            />
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 10 }}>{sourceName}</Text>
          </TouchableOpacity>
          {expandedSources[sourceName] && cals.map((cal) => (
            <TouchableOpacity
              key={cal.id}
              style={{ flexDirection: 'row', alignItems: 'center', margin: 10, marginLeft: 20 }}
              onPress={() => toggleCalendarSelection(cal.id)}
            >
              <Ionicons
                name={selectedCalendars.includes(cal.id) ? "checkbox-outline" : "square-outline"}
                size={24}
              />
              <View style={{ marginLeft: 10 }}>
                <Text>Name: {cal.title}</Text>
                <Text>Type: {cal.source.type}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <TouchableOpacity style={{ backgroundColor: 'cornflowerblue', padding: 10, margin: 10, borderRadius: 10 }} onPress={() => {
        if(booked?.id) debouncedSyncCalendarEvents(booked.id, events, setClearingBookedEvents);
      }}>
        <Text style={{ textAlign: 'center' }}>Sync Calendar</Text>
      </TouchableOpacity>
      {clearingBookedEvents && (
        <Text style={{ color: 'red', textAlign: 'center', margin: 10 }}>Clearing booked events...</Text>
      )}
    </ScrollView>
  );
}
